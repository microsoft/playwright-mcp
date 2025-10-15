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

import fs from 'fs';
import http from 'http';
import https from 'https';
import path from 'path';
import debug from 'debug';

const fulfillSymbol = Symbol('fulfil callback');
const rejectSymbol = Symbol('reject callback');

export class TestServer {
  private _server: http.Server;
  readonly debugServer: any;
  private _routes = new Map<string, (request: http.IncomingMessage, response: http.ServerResponse) => any>();
  private _csp = new Map<string, string>();
  private _extraHeaders = new Map<string, object>();
  private _requestSubscribers = new Map<string, Promise<any>>();
  readonly PORT: number;
  readonly PREFIX: string;
  readonly CROSS_PROCESS_PREFIX: string;
  readonly HELLO_WORLD: string;

  static async create(port: number): Promise<TestServer> {
    const server = new TestServer(port);
    await new Promise(x => server._server.once('listening', x));
    return server;
  }

  static async createHTTPS(port: number): Promise<TestServer> {
    const server = new TestServer(port, {
      key: await fs.promises.readFile(path.join(path.dirname(__filename), 'key.pem')),
      cert: await fs.promises.readFile(path.join(path.dirname(__filename), 'cert.pem')),
      passphrase: 'aaaa',
    });
    await new Promise(x => server._server.once('listening', x));
    return server;
  }

  constructor(port: number, sslOptions?: object) {
    if (sslOptions)
      this._server = https.createServer(sslOptions, this._onRequest.bind(this));
    else
      this._server = http.createServer(this._onRequest.bind(this));
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

  setCSP(path: string, csp: string) {
    this._csp.set(path, csp);
  }

  setExtraHeaders(path: string, object: Record<string, string>) {
    this._extraHeaders.set(path, object);
  }

  async stop() {
    this.reset();
    await new Promise(x => this._server.close(x));
  }

  route(path: string, handler: (request: http.IncomingMessage, response: http.ServerResponse) => any) {
    this._routes.set(path, handler);
  }

  setContent(path: string, content: string, mimeType: string) {
    this.route(path, (req, res) => {
      res.writeHead(200, { 'Content-Type': mimeType });
      res.end(mimeType === 'text/html' ? `<!DOCTYPE html>${content}` : content);
    });
  }

  redirect(from: string, to: string) {
    this.route(from, (req, res) => {
      const headers = this._extraHeaders.get(req.url!) || {};
      res.writeHead(302, { ...headers, location: to });
      res.end();
    });
  }

  waitForRequest(path: string): Promise<http.IncomingMessage> {
    let promise = this._requestSubscribers.get(path);
    if (promise)
      return promise;
    let fulfill, reject;
    promise = new Promise((f, r) => {
      fulfill = f;
      reject = r;
    });
    promise[fulfillSymbol] = fulfill;
    promise[rejectSymbol] = reject;
    this._requestSubscribers.set(path, promise);
    return promise;
  }

  reset() {
    this._routes.clear();
    this._csp.clear();
    this._extraHeaders.clear();
    this._server.closeAllConnections();
    const error = new Error('Static Server has been reset');
    for (const subscriber of this._requestSubscribers.values())
      subscriber[rejectSymbol].call(null, error);
    this._requestSubscribers.clear();

    this.setContent('/favicon.ico', '', 'image/x-icon');

    this.setContent('/', ``, 'text/html');

    this.setContent('/hello-world', `
      <title>Title</title>
      <body>Hello, world!</body>
    `, 'text/html');
  }

  _onRequest(request: http.IncomingMessage, response: http.ServerResponse) {
    request.on('error', error => {
      if ((error as any).code === 'ECONNRESET')
        response.end();
      else
        throw error;
    });
    (request as any).postBody = new Promise(resolve => {
      const chunks: Buffer[] = [];
      request.on('data', chunk => {
        chunks.push(chunk);
      });
      request.on('end', () => resolve(Buffer.concat(chunks)));
    });
    const path = request.url || '/';
    this.debugServer(`request ${request.method} ${path}`);
    // Notify request subscriber.
    if (this._requestSubscribers.has(path)) {
      this._requestSubscribers.get(path)![fulfillSymbol].call(null, request);
      this._requestSubscribers.delete(path);
    }
    const handler = this._routes.get(path);
    if (handler) {
      handler.call(null, request, response);
    } else {
      response.writeHead(404);
      response.end();
    }
  }
}
