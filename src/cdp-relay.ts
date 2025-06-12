/* eslint-disable no-console */
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

import { WebSocket, WebSocketServer } from 'ws';
import http from 'node:http';
import { EventEmitter } from 'node:events';
import debug from 'debug';

const debugLogger = debug('pw-mcp:cdp-relay');

export class CDPBridgeServer extends EventEmitter {
  private _wss: WebSocketServer;
  private _playwrightSocket: WebSocket | null = null;
  private _extensionSocket: WebSocket | null = null;
  private _pendingCommands = new Map<number, any>();
  private _connectionInfo: {
    tabId?: number;
    targetId?: string;
    browserContextId?: string;
    targetInfo?: any;
  } = {};

  public readonly CDP_PATH = '/cdp';
  public readonly EXTENSION_PATH = '/extension';

  constructor(server: http.Server) {
    super();
    this._wss = new WebSocketServer({ server });
    this._wss.on('connection', this._onConnection.bind(this));
  }

  stop(): void {
    this._playwrightSocket?.close();
    this._extensionSocket?.close();
  }

  private _onConnection(ws: WebSocket, request: http.IncomingMessage): void {
    const url = new URL(`http://localhost${request.url}`);

    debugLogger(`New connection to ${url.pathname}`);

    if (url.pathname === this.CDP_PATH) {
      this._handlePlaywrightConnection(ws);
    } else if (url.pathname === this.EXTENSION_PATH) {
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

    ws.on('message', data => {
      try {
        const message = JSON.parse(data.toString());
        this._handlePlaywrightMessage(message);
      } catch (error) {
        debugLogger('Error parsing Playwright message:', error);
      }
    });

    ws.on('close', () => {
      if (this._playwrightSocket === ws)
        this._playwrightSocket = null;

      debugLogger('Playwright MCP disconnected');
    });

    ws.on('error', error => {
      debugLogger('Playwright WebSocket error:', error);
    });
  }

  /**
   * Handle Extension connection - forwards to chrome.debugger
   */
  private _handleExtensionConnection(ws: WebSocket): void {
    if (this._extensionSocket?.readyState === WebSocket.OPEN) {
      debugLogger('Closing previous extension connection');
      this._extensionSocket.close(1000, 'New connection established');
    }

    this._extensionSocket = ws;
    debugLogger('Extension connected');

    ws.on('message', data => {
      try {
        const message = JSON.parse(data.toString());
        this._handleExtensionMessage(message);
      } catch (error) {
        debugLogger('Error parsing extension message:', error);
      }
    });

    ws.on('close', () => {
      if (this._extensionSocket === ws)
        this._extensionSocket = null;

      debugLogger('Extension disconnected');
    });

    ws.on('error', error => {
      debugLogger('Extension WebSocket error:', error);
    });
  }

  /**
   * Handle messages from Playwright MCP
   */
  private _handlePlaywrightMessage(message: any): void {
    debugLogger('← Playwright:', message.method || `response(${message.id})`);

    // Handle Browser domain methods locally
    if (message.method?.startsWith('Browser.')) {
      this._handleBrowserDomainMethod(message);
      return;
    }

    // Handle Target domain methods
    if (message.method?.startsWith('Target.')) {
      this._handleTargetDomainMethod(message);
      return;
    }

    // Forward other commands to extension
    if (message.method)
      this._forwardToExtension(message);

  }

  /**
   * Handle messages from Extension
   */
  private _handleExtensionMessage(message: any): void {
    // Handle connection info from extension
    if (message.type === 'connection_info') {
      debugLogger('Received connection info from extension:', message);
      this._connectionInfo = {
        tabId: message.tabId,
        targetId: message.targetId,
        browserContextId: message.browserContextId,
        targetInfo: message.targetInfo
      };
      return;
    }

    if (message.method) {
      // CDP event from extension
      debugLogger('← Extension event:', message.method);
      this._forwardToPlaywright(message);
    } else if (message.id !== undefined) {
      // Command response from extension
      debugLogger('← Extension response:', message.id);
      this._forwardToPlaywright(message);
    } else {
      debugLogger('← Extension unknown message:', message);
      this._forwardToPlaywright(message);
    }
  }

  /**
   * Handle Browser domain methods locally
   */
  private _handleBrowserDomainMethod(message: any): void {
    switch (message.method) {
      case 'Browser.getVersion':
        this._sendToPlaywright({
          id: message.id,
          result: {
            protocolVersion: '1.3',
            product: 'Chrome/Extension-Bridge',
            userAgent: 'CDP-Bridge-Server/1.0.0',
          }
        });
        break;

      case 'Browser.setDownloadBehavior':
        this._sendToPlaywright({
          id: message.id,
          result: {}
        });
        break;

      default:
        // Forward unknown Browser methods to extension
        this._forwardToExtension(message);
    }
  }

  /**
   * Handle Target domain methods
   */
  private _handleTargetDomainMethod(message: any): void {
    switch (message.method) {
      case 'Target.setAutoAttach':
        // Simulate auto-attach behavior with real target info
        if (this._connectionInfo.targetId && this._connectionInfo.browserContextId && !message.sessionId) {
          debugLogger('Simulating auto-attach for target:', JSON.stringify(message));
          this._sendToPlaywright({
            method: 'Target.attachedToTarget',
            params: {
              sessionId: 'bridge-session-1',
              targetInfo: {
                targetId: this._connectionInfo.targetId,
                browserContextId: this._connectionInfo.browserContextId,
                type: 'page',
                title: this._connectionInfo.targetInfo?.title || 'Browser Tab',
                url: this._connectionInfo.targetInfo?.url || 'about:blank',
                attached: true,
                canAccessOpener: false
              },
              waitingForDebugger: false
            }
          });
          this._sendToPlaywright({
            id: message.id,
            result: {}
          });
        } else {
          this._forwardToExtension(message);
        }
        break;

      case 'Target.getTargets':
        const targetInfos = [];

        if (this._connectionInfo.targetId) {
          targetInfos.push({
            targetId: this._connectionInfo.targetId,
            browserContextId: this._connectionInfo.browserContextId,
            type: 'page',
            title: this._connectionInfo.targetInfo?.title || 'Browser Tab',
            url: this._connectionInfo.targetInfo?.url || 'about:blank',
            attached: true,
            canAccessOpener: false
          });
        } else {
          // Fallback
          targetInfos.push({
            targetId: 'bridge-target-1',
            type: 'page',
            title: 'Bridge Target',
            url: 'about:blank',
            attached: true,
            canAccessOpener: false
          });
        }

        this._sendToPlaywright({
          id: message.id,
          result: { targetInfos }
        });
        break;

      default:
        this._forwardToExtension(message);
    }
  }

  /**
   * Forward message to extension
   */
  private _forwardToExtension(message: any): void {
    if (this._extensionSocket?.readyState === WebSocket.OPEN) {
      debugLogger('→ Extension:', message.method || `command(${message.id})`);
      this._extensionSocket.send(JSON.stringify(message));

      if (message.id)
        this._pendingCommands.set(message.id, Date.now());

    } else {
      debugLogger('Extension not connected, cannot forward message');
      if (message.id) {
        this._sendToPlaywright({
          id: message.id,
          error: { message: 'Extension not connected' }
        });
      }
    }
  }

  /**
   * Forward message to Playwright
   */
  private _forwardToPlaywright(message: any): void {
    if (this._playwrightSocket?.readyState === WebSocket.OPEN) {
      debugLogger('→ Playwright:', JSON.stringify(message));
      this._playwrightSocket.send(JSON.stringify(message));

      if (message.id)
        this._pendingCommands.delete(message.id);

    }
  }

  private _sendToPlaywright(message: any): void {
    debugLogger('→ Playwright:', message.method, `response(${message.id})`);
    this._forwardToPlaywright(message);
  }
}

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  const port = parseInt(process.argv[2], 10) || 9223;
  const httpServer = http.createServer();
  await new Promise<void>(resolve => httpServer.listen(port, resolve));
  const server = new CDPBridgeServer(httpServer);

  console.error(`CDP Bridge Server listening on ws://localhost:${port}`);
  console.error(`- Playwright MCP: ws://localhost:${port}${server.CDP_PATH}`);
  console.error(`- Extension: ws://localhost:${port}${server.EXTENSION_PATH}`);

  process.on('SIGINT', () => {
    debugLogger('\nShutting down bridge server...');
    server.stop();
    process.exit(0);
  });
}
