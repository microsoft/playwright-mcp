/**
 * WebSocket server that bridges Playwright MCP and Chrome Extension
 *
 * Endpoints:
 * - /cdp/guid - Full CDP interface for Playwright MCP
 * - /extension/guid - Extension connection for chrome.debugger forwarding
 */
import { spawn } from 'node:child_process';
import type http from 'node:http';
import debug from 'debug';
import type websocket from 'ws';
import { WebSocket, WebSocketServer } from 'ws';
import type { ClientInfo } from '../browser-context-factory.js';
import { httpAddressToString } from '../httpServer.js';
import { logUnhandledError } from '../log.js';
import { ManualPromise } from '../manualPromise.js';

//
// @ts-expect-error - playwright internal module
const { registry } = await import('playwright-core/lib/server/registry/index');
const debugLogger = debug('pw:mcp:relay');

// Regex constants for performance
const HTTP_TO_WS_REGEX = /^http/;
// CDP parameter types - using unknown for better type safety
type CDPParams = Record<string, unknown> | undefined;

type CDPCommand = {
  id: number;
  sessionId?: string;
  method: string;
  params?: CDPParams;
};

type CDPResponse = {
  id?: number;
  sessionId?: string;
  method?: string;
  params?: CDPParams;
  result?: unknown;
  error?: { code?: number; message: string };
};
export class CDPRelayServer {
  private _wsHost: string;
  private _browserChannel: string;
  private _cdpPath: string;
  private _extensionPath: string;
  private _wss: WebSocketServer;
  private _playwrightConnection: WebSocket | null = null;
  private _extensionConnection: ExtensionConnection | null = null;
  // biome-ignore lint/correctness/noUnusedPrivateClassMembers: Used in line 274 for session ID generation
  private _nextSessionId = 0;
  private _connectedTabInfo:
    | {
        targetInfo: Record<string, unknown>;
        // Page sessionId that should be used by this connection.
        sessionId: string;
      }
    | undefined;
  private _extensionConnectionPromise!: ManualPromise<void>;
  constructor(server: http.Server, browserChannel: string) {
    this._wsHost = httpAddressToString(server.address()).replace(
      HTTP_TO_WS_REGEX,
      'ws'
    );
    this._browserChannel = browserChannel;
    const uuid = crypto.randomUUID();
    this._cdpPath = `/cdp/${uuid}`;
    this._extensionPath = `/extension/${uuid}`;
    this._resetExtensionConnection();
    this._wss = new WebSocketServer({ server });
    this._wss.on('connection', this._onConnection.bind(this));
  }
  cdpEndpoint() {
    return `${this._wsHost}${this._cdpPath}`;
  }
  extensionEndpoint() {
    return `${this._wsHost}${this._extensionPath}`;
  }
  async ensureExtensionConnectionForMCPContext(
    clientInfo: ClientInfo,
    abortSignal: AbortSignal
  ) {
    debugLogger('Ensuring extension connection for MCP context');
    if (this._extensionConnection) {
      return;
    }
    this._connectBrowser(clientInfo);
    debugLogger('Waiting for incoming extension connection');
    await Promise.race([
      this._extensionConnectionPromise,
      new Promise((_, reject) => abortSignal.addEventListener('abort', reject)),
    ]);
    debugLogger('Extension connection established');
  }
  private _connectBrowser(clientInfo: ClientInfo) {
    const mcpRelayEndpoint = `${this._wsHost}${this._extensionPath}`;
    // Need to specify "key" in the manifest.json to make the id stable when loading from file.
    const url = new URL(
      'chrome-extension://jakfalbnbhgkpmoaakfflhflbfpkailf/lib/ui/connect.html'
    );
    url.searchParams.set('mcpRelayUrl', mcpRelayEndpoint);
    url.searchParams.set('client', JSON.stringify(clientInfo));
    const href = url.toString();
    const executableInfo = registry.findExecutable(this._browserChannel);
    if (!executableInfo) {
      throw new Error(`Unsupported channel: "${this._browserChannel}"`);
    }
    const executablePath = executableInfo.executablePath();
    if (!executablePath) {
      throw new Error(
        `"${this._browserChannel}" executable not found. Make sure it is installed at a standard location.`
      );
    }
    spawn(executablePath, [href], {
      windowsHide: true,
      detached: true,
      shell: false,
      stdio: 'ignore',
    });
  }
  stop(): void {
    this.closeConnections('Server stopped');
    this._wss.close();
  }
  closeConnections(reason: string) {
    this._closePlaywrightConnection(reason);
    this._closeExtensionConnection(reason);
  }
  private _onConnection(ws: WebSocket, request: http.IncomingMessage): void {
    const url = new URL(`http://localhost${request.url}`);
    debugLogger(`New connection to ${url.pathname}`);
    if (url.pathname === this._cdpPath) {
      this._handlePlaywrightConnection(ws);
    } else if (url.pathname === this._extensionPath) {
      this._handleExtensionConnection(ws);
    } else {
      debugLogger(`Invalid path: ${url.pathname}`);
      ws.close(4004, 'Invalid path');
    }
  }
  private _handlePlaywrightConnection(ws: WebSocket): void {
    if (this._playwrightConnection) {
      debugLogger('Rejecting second Playwright connection');
      ws.close(1000, 'Another CDP client already connected');
      return;
    }
    this._playwrightConnection = ws;
    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());
        await this._handlePlaywrightMessage(message);
      } catch (error: unknown) {
        debugLogger(
          `Error while handling Playwright message\n${data.toString()}\n`,
          error
        );
      }
    });
    ws.on('close', () => {
      if (this._playwrightConnection !== ws) {
        return;
      }
      this._playwrightConnection = null;
      this._closeExtensionConnection('Playwright client disconnected');
      debugLogger('Playwright WebSocket closed');
    });
    ws.on('error', (error) => {
      debugLogger('Playwright WebSocket error:', error);
    });
    debugLogger('Playwright MCP connected');
  }
  private _closeExtensionConnection(reason: string) {
    this._extensionConnection?.close(reason);
    this._extensionConnectionPromise.reject(new Error(reason));
    this._resetExtensionConnection();
  }
  private _resetExtensionConnection() {
    this._connectedTabInfo = undefined;
    this._extensionConnection = null;
    this._extensionConnectionPromise = new ManualPromise();
    this._extensionConnectionPromise.catch(logUnhandledError);
  }
  private _closePlaywrightConnection(reason: string) {
    if (this._playwrightConnection?.readyState === WebSocket.OPEN) {
      this._playwrightConnection.close(1000, reason);
    }
    this._playwrightConnection = null;
  }
  private _handleExtensionConnection(ws: WebSocket): void {
    if (this._extensionConnection) {
      ws.close(1000, 'Another extension connection already established');
      return;
    }
    this._extensionConnection = new ExtensionConnection(ws);
    this._extensionConnection.onclose = (c, reason) => {
      debugLogger(
        'Extension WebSocket closed:',
        reason,
        c === this._extensionConnection
      );
      if (this._extensionConnection !== c) {
        return;
      }
      this._resetExtensionConnection();
      this._closePlaywrightConnection(`Extension disconnected: ${reason}`);
    };
    this._extensionConnection.onmessage =
      this._handleExtensionMessage.bind(this);
    this._extensionConnectionPromise.resolve();
  }
  private _handleExtensionMessage(
    method: string,
    params: Record<string, unknown>
  ) {
    switch (method) {
      case 'forwardCDPEvent': {
        const sessionId =
          (params.sessionId as string | undefined) ||
          this._connectedTabInfo?.sessionId;
        this._sendToPlaywright({
          sessionId,
          method: params.method as string | undefined,
          params: params.params as CDPParams,
        });
        break;
      }
      case 'detachedFromTab':
        debugLogger('← Debugger detached from tab:', params);
        this._connectedTabInfo = undefined;
        break;
      default:
        debugLogger(`← Extension: unhandled method ${method}`, params);
        break;
    }
  }
  private async _handlePlaywrightMessage(message: CDPCommand): Promise<void> {
    debugLogger('← Playwright:', `${message.method} (id=${message.id})`);
    const { id, sessionId, method, params } = message;
    try {
      const result = await this._handleCDPCommand(method, params, sessionId);
      this._sendToPlaywright({ id, sessionId, result });
    } catch (e) {
      debugLogger('Error in the extension:', e);
      this._sendToPlaywright({
        id,
        sessionId,
        error: { message: (e as Error).message },
      });
    }
  }
  private async _handleCDPCommand(
    method: string,
    params: CDPParams,
    sessionId: string | undefined
  ): Promise<unknown> {
    switch (method) {
      case 'Browser.getVersion': {
        return {
          protocolVersion: '1.3',
          product: 'Chrome/Extension-Bridge',
          userAgent: 'CDP-Bridge-Server/1.0.0',
        };
      }
      case 'Browser.setDownloadBehavior': {
        return {};
      }
      case 'Target.setAutoAttach': {
        // Forward child session handling.
        if (sessionId) {
          break;
        }
        // Simulate auto-attach behavior with real target info
        const result = (await this._extensionConnection?.send(
          'attachToTab'
        )) as { targetInfo: Record<string, unknown> };
        const targetInfo = result.targetInfo;
        this._connectedTabInfo = {
          targetInfo,
          sessionId: `pw-tab-${this._nextSessionId++}`,
        };
        debugLogger('Simulating auto-attach');
        this._sendToPlaywright({
          method: 'Target.attachedToTarget',
          params: {
            sessionId: this._connectedTabInfo.sessionId,
            targetInfo: {
              ...this._connectedTabInfo.targetInfo,
              attached: true,
            },
            waitingForDebugger: false,
          },
        });
        return {};
      }
      case 'Target.getTargetInfo': {
        return this._connectedTabInfo?.targetInfo;
      }
      default:
        // Fall through to forward to extension
        break;
    }
    return await this._forwardToExtension(method, params, sessionId);
  }
  private async _forwardToExtension(
    method: string,
    params: CDPParams,
    sessionId: string | undefined
  ): Promise<unknown> {
    if (!this._extensionConnection) {
      throw new Error('Extension not connected');
    }
    // Top level sessionId is only passed between the relay and the client.
    let effectiveSessionId = sessionId;
    if (this._connectedTabInfo?.sessionId === sessionId) {
      effectiveSessionId = undefined;
    }
    return await this._extensionConnection.send('forwardCDPCommand', {
      sessionId: effectiveSessionId,
      method,
      params,
    });
  }
  private _sendToPlaywright(message: CDPResponse): void {
    debugLogger(
      '→ Playwright:',
      `${message.method ?? `response(id=${message.id})`}`
    );
    this._playwrightConnection?.send(JSON.stringify(message));
  }
}
type ExtensionResponse = {
  id?: number;
  method?: string;
  params?: Record<string, unknown>;
  result?: unknown;
  error?: string;
};
class ExtensionConnection {
  private readonly _ws: WebSocket;
  // biome-ignore lint/correctness/noUnusedPrivateClassMembers: Used in line 356 for message ID generation
  private _lastId = 0;
  private readonly _callbacks = new Map<
    number,
    { resolve: (o: unknown) => void; reject: (e: Error) => void; error: Error }
  >();
  onmessage?: (method: string, params: Record<string, unknown>) => void;
  onclose?: (self: ExtensionConnection, reason: string) => void;
  constructor(ws: WebSocket) {
    this._ws = ws;
    this._ws.on('message', this._onMessage.bind(this));
    this._ws.on('close', this._onClose.bind(this));
    this._ws.on('error', this._onError.bind(this));
  }
  send(
    method: string,
    params?: CDPParams,
    sessionId?: string
  ): Promise<unknown> {
    if (this._ws.readyState !== WebSocket.OPEN) {
      throw new Error(`Unexpected WebSocket state: ${this._ws.readyState}`);
    }
    const id = ++this._lastId;
    this._ws.send(JSON.stringify({ id, method, params, sessionId }));
    const error = new Error(`Protocol error: ${method}`);
    return new Promise((resolve, reject) => {
      this._callbacks.set(id, { resolve, reject, error });
    });
  }
  close(message: string) {
    debugLogger('closing extension connection:', message);
    if (this._ws.readyState === WebSocket.OPEN) {
      this._ws.close(1000, message);
    }
  }
  private _onMessage(event: websocket.RawData) {
    const eventData = event.toString();
    let parsedJson: ExtensionResponse;
    try {
      parsedJson = JSON.parse(eventData);
    } catch (e: unknown) {
      debugLogger(
        `<closing ws> Closing websocket due to malformed JSON. eventData=${eventData} e=${(e as Error)?.message}`
      );
      this._ws.close();
      return;
    }
    try {
      this._handleParsedMessage(parsedJson);
    } catch (e: unknown) {
      debugLogger(
        `<closing ws> Closing websocket due to failed onmessage callback. eventData=${eventData} e=${(e as Error)?.message}`
      );
      this._ws.close();
    }
  }
  private _handleParsedMessage(object: ExtensionResponse) {
    if (object.id && this._callbacks.has(object.id)) {
      const callback = this._callbacks.get(object.id);
      if (!callback) {
        return;
      }
      this._callbacks.delete(object.id);
      if (object.error) {
        const error = callback.error;
        error.message = object.error;
        callback.reject(error);
      } else {
        callback.resolve(object.result);
      }
    } else if (object.id) {
      debugLogger('← Extension: unexpected response', object);
    } else if (object.method) {
      this.onmessage?.(object.method, object.params || {});
    }
  }
  private _onClose(event: websocket.CloseEvent) {
    debugLogger(`<ws closed> code=${event.code} reason=${event.reason}`);
    this._dispose();
    this.onclose?.(this, event.reason);
  }
  private _onError(event: websocket.ErrorEvent) {
    debugLogger(
      `<ws error> message=${event.message} type=${event.type} target=${event.target}`
    );
    this._dispose();
  }
  private _dispose() {
    for (const callback of this._callbacks.values()) {
      callback.reject(new Error('WebSocket closed'));
    }
    this._callbacks.clear();
  }
}
