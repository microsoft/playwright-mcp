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
 * Bridge Server - Standalone WebSocket server that bridges Playwright MCP and Chrome Extension
 *
 * Endpoints:
 * - /cdp - Full CDP interface for Playwright MCP
 * - /extension - Extension connection for chrome.debugger forwarding
 */

/* eslint-disable no-console */

import { WebSocket, WebSocketServer } from 'ws';
import http from 'node:http';
import debug from 'debug';
import { httpAddressToString } from './transport.js';

const debugLogger = debug('pw:mcp:relay');

const CDP_PATH = '/cdp';
const EXTENSION_PATH = '/extension';

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
  private _wss: WebSocketServer;
  private _playwrightSocket: WebSocket | null = null;
  private _extensionConnection: ExtensionConnection | null = null;
  private _connectionInfo: {
    targetInfo: any;
    // Page sessionId that should be used by this connection.
    sessionId: string;
  } | undefined;

  constructor(server: http.Server) {
    this._wss = new WebSocketServer({ server });
    this._wss.on('connection', this._onConnection.bind(this));
  }

  stop(): void {
    this._playwrightSocket?.close();
    this._extensionConnection?.close();
  }

  private _onConnection(ws: WebSocket, request: http.IncomingMessage): void {
    const url = new URL(`http://localhost${request.url}`);
    debugLogger(`New connection to ${url.pathname}`);
    if (url.pathname === CDP_PATH) {
      this._handlePlaywrightConnection(ws);
    } else if (url.pathname === EXTENSION_PATH) {
      this._handleExtensionConnection(ws);
    } else {
      debugLogger(`Invalid path: ${url.pathname}`);
      ws.close(4004, 'Invalid path');
    }
  }

  /**
   * Handle Playwright MCP connection - provides full CDP interface
   */
  private _handlePlaywrightConnection(ws: WebSocket): void {
    if (this._playwrightSocket?.readyState === WebSocket.OPEN) {
      debugLogger('Closing previous Playwright connection');
      this._playwrightSocket.close(1000, 'New connection established');
    }
    this._playwrightSocket = ws;
    debugLogger('Playwright MCP connected');
    ws.on('message', async data => {
      try {
        const message = JSON.parse(data.toString());
        await this._handlePlaywrightMessage(message);
      } catch (error) {
        debugLogger('Error parsing Playwright message:', error);
      }
    });
    ws.on('close', () => {
      if (this._playwrightSocket === ws) {
        void this._detachDebugger();
        this._playwrightSocket = null;
      }
      debugLogger('Playwright MCP disconnected');
    });
    ws.on('error', error => {
      debugLogger('Playwright WebSocket error:', error);
    });
  }

  private async _detachDebugger() {
    this._connectionInfo = undefined;
    await this._extensionConnection?.send('detachFromTab', {});
  }

  private _handleExtensionConnection(ws: WebSocket): void {
    if (this._extensionConnection)
      this._extensionConnection.close('New connection established');
    this._extensionConnection = new ExtensionConnection(ws);
    this._extensionConnection.onclose = c => {
      if (this._extensionConnection === c)
        this._extensionConnection = null;
    };
    this._extensionConnection.onmessage = this._handleExtensionMessage.bind(this);
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
        this._connectionInfo = undefined;
        this._extensionConnection?.close();
        this._extensionConnection = null;
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
          this._connectionInfo = await this._extensionConnection!.send('attachToTab');
          debugLogger('Simulating auto-attach for target:', message);
          this._sendToPlaywright({
            method: 'Target.attachedToTarget',
            params: {
              sessionId: this._connectionInfo!.sessionId,
              targetInfo: {
                ...this._connectionInfo!.targetInfo,
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
          result: this._connectionInfo?.targetInfo
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
    this._playwrightSocket?.send(JSON.stringify(message));
  }
}

export async function startCDPRelayServer(httpServer: http.Server) {
  const wsAddress = httpAddressToString(httpServer.address()).replace(/^http/, 'ws');
  const cdpRelayServer = new CDPRelayServer(httpServer);
  process.on('exit', () => cdpRelayServer.stop());
  console.error(`CDP relay server started on ${wsAddress}${EXTENSION_PATH} - Connect to it using the browser extension.`);
  const cdpEndpoint = `${wsAddress}${CDP_PATH}`;
  return cdpEndpoint;
}

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  const port = parseInt(process.argv[2], 10) || 9223;
  const httpServer = http.createServer();
  await new Promise<void>(resolve => httpServer.listen(port, resolve));
  const server = new CDPRelayServer(httpServer);

  console.error(`CDP Bridge Server listening on ws://localhost:${port}`);
  console.error(`- Playwright MCP: ws://localhost:${port}${CDP_PATH}`);
  console.error(`- Extension: ws://localhost:${port}${EXTENSION_PATH}`);

  process.on('SIGINT', () => {
    debugLogger('\nShutting down bridge server...');
    server.stop();
    process.exit(0);
  });
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
      throw new Error('WebSocket closed');
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

  private _onMessage(event: WebSocket.RawData) {
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

  private _onClose(event: WebSocket.CloseEvent) {
    debugLogger(`<ws closed> code=${event.code} reason=${event.reason}`);
    this._dispose();
  }

  private _onError(event: WebSocket.ErrorEvent) {
    debugLogger(`<ws error> message=${event.message} type=${event.type} target=${event.target}`);
    this._dispose();
  }

  private _dispose() {
    for (const callback of this._callbacks.values())
      callback.reject(new Error('WebSocket closed'));
    this._callbacks.clear();
  }
}
