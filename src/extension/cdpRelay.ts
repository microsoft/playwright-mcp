/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * WebSocket server that bridges Playwright MCP and Chrome Extension
 *
 * Endpoints:
 * - /cdp/guid - Full CDP interface for Playwright MCP
 * - /extension/guid - Extension connection for chrome.debugger forwarding
 */

import http from 'http';
import { spawn } from 'child_process';
import { WebSocket, WebSocketServer } from 'ws';
import debug from 'debug';
import * as playwright from 'playwright';
import { httpAddressToString, startHttpServer } from '../transport.js';
import { BrowserContextFactory } from '../browserContextFactory.js';
// @ts-ignore
const { registry } = await import('playwright-core/lib/server/registry/index');

import type websocket from 'ws';

const debugLogger = debug('pw:mcp:relay');

type CDPCommand = {
  id: number;
  sessionId?: string;
  method: string;
  params?: any;
};

type CDPResponse = {
  id?: number;
  sessionId?: string;
  method?: string;
  params?: any;
  result?: any;
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
  private _connectedTabInfo: {
    targetInfo: any;
    // Page sessionId that should be used by this connection.
    sessionId: string;
  } | undefined;
  private _extensionConnectionPromise: Promise<void>;
  private _extensionConnectionResolve: (() => void) | null = null;

  constructor(server: http.Server, browserChannel: string) {
    this._wsHost = httpAddressToString(server.address()).replace(/^http/, 'ws');
    this._browserChannel = browserChannel;

    const uuid = crypto.randomUUID();
    this._cdpPath = `/cdp/${uuid}`;
    this._extensionPath = `/extension/${uuid}`;

    this._extensionConnectionPromise = new Promise(resolve => {
      this._extensionConnectionResolve = resolve;
    });
    this._wss = new WebSocketServer({ server });
    this._wss.on('connection', this._onConnection.bind(this));
  }

  cdpEndpoint() {
    return `${this._wsHost}${this._cdpPath}`;
  }

  extensionEndpoint() {
    return `${this._wsHost}${this._extensionPath}`;
  }

  async ensureExtensionConnectionForMCPContext(clientInfo: { name: string, version: string }) {
    debugLogger('Ensuring extension connection for MCP context');
    if (this._extensionConnection)
      return;
    await this._connectBrowser(clientInfo);
    debugLogger('Waiting for incoming extension connection');
    await this._extensionConnectionPromise;
    debugLogger('Extension connection established');
  }

  private async _connectBrowser(clientInfo: { name: string, version: string }) {
    const mcpRelayEndpoint = `${this._wsHost}${this._extensionPath}`;
    // Need to specify "key" in the manifest.json to make the id stable when loading from file.
    const url = new URL('chrome-extension://jakfalbnbhgkpmoaakfflhflbfpkailf/connect.html');
    url.searchParams.set('mcpRelayUrl', mcpRelayEndpoint);
    url.searchParams.set('client', JSON.stringify(clientInfo));
    const href = url.toString();
    const executableInfo = registry.findExecutable(this._browserChannel);
    if (!executableInfo)
      throw new Error(`Unsupported channel: "${this._browserChannel}"`);
    const executablePath = executableInfo.executablePath();
    if (!executablePath)
      throw new Error(`"${this._browserChannel}" executable not found. Make sure it is installed at a standard location.`);

    spawn(executablePath, [href], {
      windowsHide: true,
      detached: true,
      shell: false,
      stdio: 'ignore',
    });
  }

  stop(): void {
    this._playwrightConnection?.close();
    this._extensionConnection?.close();
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
    this._playwrightConnection = ws;
    ws.on('message', async data => {
      try {
        const message = JSON.parse(data.toString());
        await this._handlePlaywrightMessage(message);
      } catch (error) {
        debugLogger('Error parsing Playwright message:', error);
      }
    });
    ws.on('close', () => {
      if (this._playwrightConnection === ws) {
        this._playwrightConnection = null;
        this._closeExtensionConnection();
        debugLogger('Playwright MCP disconnected');
      }
    });
    ws.on('error', error => {
      debugLogger('Playwright WebSocket error:', error);
    });
    debugLogger('Playwright MCP connected');
  }

  private _closeExtensionConnection() {
    this._connectedTabInfo = undefined;
    this._extensionConnection?.close();
    this._extensionConnection = null;
    this._extensionConnectionPromise = new Promise(resolve => {
      this._extensionConnectionResolve = resolve;
    });
  }

  private _handleExtensionConnection(ws: WebSocket): void {
    if (this._extensionConnection) {
      ws.close(1000, 'Another extension connection already established');
      return;
    }
    this._extensionConnection = new ExtensionConnection(ws);
    this._extensionConnection.onclose = c => {
      if (this._extensionConnection === c)
        this._extensionConnection = null;
    };
    this._extensionConnection.onmessage = this._handleExtensionMessage.bind(this);
    this._extensionConnectionResolve?.();
  }

  private _handleExtensionMessage(method: string, params: any) {
    switch (method) {
      case 'forwardCDPEvent':
        this._sendToPlaywright({
          sessionId: params.sessionId,
          method: params.method,
          params: params.params
        });
        break;
      case 'detachedFromTab':
        debugLogger('← Debugger detached from tab:', params);
        this._connectedTabInfo = undefined;
        break;
    }
  }

  private async _handlePlaywrightMessage(message: CDPCommand): Promise<void> {
    debugLogger('← Playwright:', `${message.method} (id=${message.id})`);
    if (!this._extensionConnection) {
      debugLogger('Extension not connected, sending error to Playwright');
      this._sendToPlaywright({
        id: message.id,
        error: { message: 'Extension not connected' }
      });
      return;
    }
    if (await this._interceptCDPCommand(message))
      return;
    await this._forwardToExtension(message);
  }

  private async _interceptCDPCommand(message: CDPCommand): Promise<boolean> {
    switch (message.method) {
      case 'Browser.getVersion': {
        this._sendToPlaywright({
          id: message.id,
          result: {
            protocolVersion: '1.3',
            product: 'Chrome/Extension-Bridge',
            userAgent: 'CDP-Bridge-Server/1.0.0',
          }
        });
        return true;
      }
      case 'Browser.setDownloadBehavior': {
        this._sendToPlaywright({
          id: message.id
        });
        return true;
      }
      case 'Target.setAutoAttach': {
        // Simulate auto-attach behavior with real target info
        if (!message.sessionId) {
          this._connectedTabInfo = await this._extensionConnection!.send('attachToTab');
          debugLogger('Simulating auto-attach for target:', message);
          this._sendToPlaywright({
            method: 'Target.attachedToTarget',
            params: {
              sessionId: this._connectedTabInfo!.sessionId,
              targetInfo: {
                ...this._connectedTabInfo!.targetInfo,
                attached: true,
              },
              waitingForDebugger: false
            }
          });
          this._sendToPlaywright({
            id: message.id
          });
        } else {
          await this._forwardToExtension(message);
        }
        return true;
      }
      case 'Target.getTargetInfo': {
        debugLogger('Target.getTargetInfo', message);
        this._sendToPlaywright({
          id: message.id,
          result: this._connectedTabInfo?.targetInfo
        });
        return true;
      }
    }
    return false;
  }

  private async _forwardToExtension(message: CDPCommand): Promise<void> {
    try {
      if (!this._extensionConnection)
        throw new Error('Extension not connected');
      const { id, sessionId, method, params } = message;
      const result = await this._extensionConnection.send('forwardCDPCommand', { sessionId, method, params });
      this._sendToPlaywright({ id, sessionId, result });
    } catch (e) {
      debugLogger('Error in the extension:', e);
      this._sendToPlaywright({
        id: message.id,
        sessionId: message.sessionId,
        error: { message: (e as Error).message }
      });
    }
  }

  private _sendToPlaywright(message: CDPResponse): void {
    debugLogger('→ Playwright:', `${message.method ?? `response(id=${message.id})`}`);
    this._playwrightConnection?.send(JSON.stringify(message));
  }
}

class ExtensionContextFactory implements BrowserContextFactory {
  private _relay: CDPRelayServer;
  private _browserPromise: Promise<playwright.Browser> | undefined;

  constructor(relay: CDPRelayServer) {
    this._relay = relay;
  }

  async createContext(clientInfo: { name: string, version: string }): Promise<{ browserContext: playwright.BrowserContext, close: () => Promise<void> }> {
    // First call will establish the connection to the extension.
    if (!this._browserPromise)
      this._browserPromise = this._obtainBrowser(clientInfo);
    const browser = await this._browserPromise;
    return {
      browserContext: browser.contexts()[0],
      close: async () => {}
    };
  }

  private async _obtainBrowser(clientInfo: { name: string, version: string }): Promise<playwright.Browser> {
    await this._relay.ensureExtensionConnectionForMCPContext(clientInfo);
    return await playwright.chromium.connectOverCDP(this._relay.cdpEndpoint());
  }
}

export async function startCDPRelayServer(port: number, browserChannel: string) {
  const httpServer = await startHttpServer({ port });
  const cdpRelayServer = new CDPRelayServer(httpServer, browserChannel);
  process.on('exit', () => cdpRelayServer.stop());
  debugLogger(`CDP relay server started, extension endpoint: ${cdpRelayServer.extensionEndpoint()}.`);
  return new ExtensionContextFactory(cdpRelayServer);
}

class ExtensionConnection {
  private readonly _ws: WebSocket;
  private readonly _callbacks = new Map<number, { resolve: (o: any) => void, reject: (e: Error) => void }>();
  private _lastId = 0;

  onmessage?: (method: string, params: any) => void;
  onclose?: (self: ExtensionConnection) => void;

  constructor(ws: WebSocket) {
    this._ws = ws;
    this._ws.on('message', this._onMessage.bind(this));
    this._ws.on('close', this._onClose.bind(this));
    this._ws.on('error', this._onError.bind(this));
  }

  async send(method: string, params?: any, sessionId?: string): Promise<any> {
    if (this._ws.readyState !== WebSocket.OPEN)
      throw new Error(`Unexpected WebSocket state: ${this._ws.readyState}`);
    const id = ++this._lastId;
    this._ws.send(JSON.stringify({ id, method, params, sessionId }));
    return new Promise((resolve, reject) => {
      this._callbacks.set(id, { resolve, reject });
    });
  }

  close(message?: string) {
    debugLogger('closing extension connection:', message);
    this._ws.close(1000, message ?? 'Connection closed');
    this.onclose?.(this);
  }

  private _onMessage(event: websocket.RawData) {
    const eventData = event.toString();
    let parsedJson;
    try {
      parsedJson = JSON.parse(eventData);
    } catch (e: any) {
      debugLogger(`<closing ws> Closing websocket due to malformed JSON. eventData=${eventData} e=${e?.message}`);
      this._ws.close();
      return;
    }
    try {
      this._handleParsedMessage(parsedJson);
    } catch (e: any) {
      debugLogger(`<closing ws> Closing websocket due to failed onmessage callback. eventData=${eventData} e=${e?.message}`);
      this._ws.close();
    }
  }

  private _handleParsedMessage(object: any) {
    if (object.id && this._callbacks.has(object.id)) {
      const callback = this._callbacks.get(object.id)!;
      this._callbacks.delete(object.id);
      if (object.error)
        callback.reject(new Error(object.error.message));
      else
        callback.resolve(object.result);
    } else if (object.id) {
      debugLogger('← Extension: unexpected response', object);
    } else {
      this.onmessage?.(object.method, object.params);
    }
  }

  private _onClose(event: websocket.CloseEvent) {
    debugLogger(`<ws closed> code=${event.code} reason=${event.reason}`);
    this._dispose();
  }

  private _onError(event: websocket.ErrorEvent) {
    debugLogger(`<ws error> message=${event.message} type=${event.type} target=${event.target}`);
    this._dispose();
  }

  private _dispose() {
    for (const callback of this._callbacks.values())
      callback.reject(new Error('WebSocket closed'));
    this._callbacks.clear();
  }
}
