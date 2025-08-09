/**
 * Copyright 2017 Google Inc. All rights reserved.
 * Modifications copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import http from 'node:http';
import https from 'node:https';
import url from 'node:url';
import debug from 'debug';
import { loadOrGenerateKeys } from '../../src/generateKeys.js';

const fulfillSymbol = Symbol('fulfil callback');
const rejectSymbol = Symbol('reject callback');

// NOTE: Can be removed when we drop Node.js 18 support and changed to import.meta.filename.
const __filename = url.fileURLToPath(import.meta.url);

export class TestServer {
  private _server: http.Server;
  readonly debugServer: any;
  private _routes = new Map<
    string,
    (request: http.IncomingMessage, response: http.ServerResponse) => any
  >();
  private _csp = new Map<string, string>();
  private _extraHeaders = new Map<string, object>();
  private _requestSubscribers = new Map<string, Promise<any>>();
  readonly PORT: number;
  readonly PREFIX: string;
  readonly CROSS_PROCESS_PREFIX: string;
  readonly HELLO_WORLD: string;

  static async create(port: number): Promise<TestServer> {
    const server = new TestServer(port);
    await new Promise((x) => server._server.once('listening', x));
    return server;
  }

  static async createHTTPS(port: number): Promise<TestServer> {
    // Use environment variable for SSL passphrase, with safe fallback for test environment only
    // This is acceptable as it's a test-only server and the fallback is only for testing
    const passphrase =
      process.env.TEST_SSL_PASSPHRASE || 'test-default-passphrase';

    // Load keys from environment variables or generate mock keys
    const { privateKey, certificate } = loadOrGenerateKeys();

    const server = new TestServer(port, {
      key: privateKey,
      cert: certificate,
      passphrase,
    });
    await new Promise((x) => server._server.once('listening', x));
    return server;
  }

  constructor(port: number, sslOptions?: object) {
    if (sslOptions) {
      this._server = https.createServer(sslOptions, this._onRequest.bind(this));
    } else {
      this._server = http.createServer(this._onRequest.bind(this));
    }
    this._server.listen(port);
    this.debugServer = debug('pw:testserver');

    const cross_origin = '127.0.0.1';
    const same_origin = 'localhost';
    const protocol = sslOptions ? 'https' : 'http';
    this.PORT = port;
    this.PREFIX = `${protocol}://${same_origin}:${port}/`;
    this.CROSS_PROCESS_PREFIX = `${protocol}://${cross_origin}:${port}/`;
    this.HELLO_WORLD = `${this.PREFIX}hello-world`;
  }

  setCSP(routePath: string, csp: string) {
    this._csp.set(routePath, csp);
  }

  setExtraHeaders(routePath: string, object: Record<string, string>) {
    this._extraHeaders.set(routePath, object);
  }

  async stop() {
    this.reset();
    await new Promise((x) => this._server.close(x));
  }

  route(
    routePath: string,
    handler: (
      request: http.IncomingMessage,
      response: http.ServerResponse
    ) => any
  ) {
    this._routes.set(routePath, handler);
  }

  setContent(routePath: string, content: string, mimeType: string) {
    this.route(routePath, (_req, res) => {
      res.writeHead(200, { 'Content-Type': mimeType });
      res.end(mimeType === 'text/html' ? `<!DOCTYPE html>${content}` : content);
    });
  }

  redirect(from: string, to: string) {
    this.route(from, (req, res) => {
      const headers = this._extraHeaders.get(req.url || '/') || {};
      res.writeHead(302, { ...headers, location: to });
      res.end();
    });
  }

  waitForRequest(routePath: string): Promise<http.IncomingMessage> {
    let promise = this._requestSubscribers.get(routePath);
    if (promise) {
      return promise;
    }
    let fulfill: (value: http.IncomingMessage) => void;
    let reject: (reason?: unknown) => void;
    promise = new Promise((f, r) => {
      fulfill = f;
      reject = r;
    });
    promise[fulfillSymbol] = fulfill;
    promise[rejectSymbol] = reject;
    this._requestSubscribers.set(routePath, promise);
    return promise;
  }

  reset() {
    this._routes.clear();
    this._csp.clear();
    this._extraHeaders.clear();
    this._server.closeAllConnections();
    const error = new Error('Static Server has been reset');
    for (const subscriber of this._requestSubscribers.values()) {
      subscriber[rejectSymbol].call(null, error);
    }
    this._requestSubscribers.clear();

    this.setContent('/favicon.ico', '', 'image/x-icon');

    this.setContent('/', '', 'text/html');

    this.setContent(
      '/hello-world',
      `
      <title>Title</title>
      <body>Hello, world!</body>
    `,
      'text/html'
    );
  }

  _onRequest(request: http.IncomingMessage, response: http.ServerResponse) {
    request.on('error', (error) => {
      if ((error as any).code === 'ECONNRESET') {
        response.end();
      } else {
        throw error;
      }
    });
    (request as any).postBody = new Promise((resolve) => {
      const chunks: Buffer[] = [];
      request.on('data', (chunk) => {
        chunks.push(chunk);
      });
      request.on('end', () => resolve(Buffer.concat(chunks)));
    });
    const requestPath = request.url || '/';
    this.debugServer(`request ${request.method} ${requestPath}`);
    // Notify request subscriber.
    if (this._requestSubscribers.has(requestPath)) {
      this._requestSubscribers
        .get(requestPath)
        ?.[fulfillSymbol].call(null, request);
      this._requestSubscribers.delete(requestPath);
    }
    const handler = this._routes.get(requestPath);
    if (handler) {
      handler.call(null, request, response);
    } else {
      response.writeHead(404);
      response.end();
    }
  }
}
