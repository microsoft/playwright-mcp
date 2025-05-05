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

import { WebSocket, WebSocketServer } from 'ws';
import http from 'node:http';
import crypto from 'node:crypto';
import { AddressInfo } from 'node:net';
import { ManualPromise } from './manualPromise.js';
import debug from 'debug';

const debugLogger = debug('pw-mcp:cdp-relay');

export class CDPWebSocketRelay {
  private _extensionSocket: WebSocket | null = null;
  private _browserSocket: WebSocket | null = null;
  private _server: http.Server;
  private _extensionToken: string;
  private _browserToken: string;

  private readonly kExtensionPath = '/extension';
  private readonly kBrowserPath = '/browser';
  private _waiter: ManualPromise<void> | null = null;

  constructor() {
    this._extensionToken = crypto.randomUUID();
    this._browserToken = crypto.randomUUID();
    this._server = http.createServer();
    const wss = new WebSocketServer({ server: this._server });
    wss.on('connection', this._onConnection.bind(this));
  }

  async startIfNeeded(): Promise<void> {
    if (this._server.listening)
      return;
    await new Promise<void>((resolve, reject) => {
      this._server.listen(0, 'localhost', resolve);
      this._server.on('error', reject);
    });
  }

  close() {
    this._server.close();
    this._server.closeAllConnections();
    this._browserSocket?.close();
    this._browserSocket = null;
    this._extensionSocket?.close();
    this._extensionSocket = null;
  }

  browserConnectionURL() {
    if (!this._server.listening)
      throw new Error('Relay server is not listening');
    return `ws://localhost:${(this._server.address() as AddressInfo).port}${this.kBrowserPath}?token=${this._browserToken}`;
  }

  extensionConnectionURL() {
    if (!this._server.listening)
      throw new Error('Relay server is not listening');
    return `ws://localhost:${(this._server.address() as AddressInfo).port}${this.kExtensionPath}?token=${this._extensionToken}`;
  }

  async waitForConnection() {
    this._waiter = new ManualPromise<void>();
    return this._waiter;
  }

  private _onConnection(ws: WebSocket, request: http.IncomingMessage) {
    const url = new URL(`http://localhost${request.url}`);
    const token = url.searchParams.get('token');

    if (url.pathname === this.kExtensionPath) {
      if (token !== this._extensionToken) {
        debugLogger('Invalid token for extension connection.');
        ws.close(4001, 'Invalid token');
        return;
      }
      // Handle the extension connection.
      this.handleExtensionConnection(ws);
    } else if (url.pathname === this.kBrowserPath) {
      if (token !== this._browserToken) {
        debugLogger('Invalid token for browser connection.');
        ws.close(4001, 'Invalid token');
        return;
      }
      // Handle browser connection.
      this.handleBrowserConnection(ws);
    } else {
      debugLogger('Invalid path for connection:', url.pathname);
      ws.close(4001, 'Invalid path');
    }
  }

  private handleBrowserConnection(ws: WebSocket) {
    this._browserSocket = ws;
    debugLogger(`Browser client connected.`);

    ws.on('message', data => {
      if (this._extensionSocket?.readyState === WebSocket.OPEN)
        this._extensionSocket.send(data);
      else
        ws.close(4001, 'No extension client connected');
    });

    ws.on('close', () => {
      this._browserSocket = null;
      debugLogger(`Browser disconnected.`);
    });

    ws.on('error', err => {
      debugLogger('Error on browser socket:', err);
    });
  }

  private handleExtensionConnection(ws: WebSocket) {
    if (this._extensionSocket?.readyState === WebSocket.OPEN) {
      debugLogger('Closing previous extension connection.');
      this._extensionSocket.close(1000, 'New extension connection established');
    }
    this._extensionSocket = ws;

    ws.on('message', data => {
      if (this._browserSocket?.readyState === WebSocket.OPEN)
        this._browserSocket.send(data);
    });

    ws.on('close', () => {
      if (this._extensionSocket === ws)
        this._extensionSocket = null;
      debugLogger('Extension disconnected.');
    });

    ws.on('error', err => {
      debugLogger('Error on extension socket:', err);
    });
    this._waiter?.resolve();
  }
}
