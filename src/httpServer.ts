/**
 * Copyright (c) Microsoft Corporation.
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
import path from 'path';
import http from 'http';
import net from 'net';

import mime from 'mime';

import { ManualPromise } from './manualPromise.js';


export type ServerRouteHandler = (request: http.IncomingMessage, response: http.ServerResponse) => void;

export type Transport = {
  sendEvent?: (method: string, params: any) => void;
  close?: () => void;
  onconnect: () => void;
  dispatch: (method: string, params: any) => Promise<any>;
  onclose: () => void;
};

export class HttpServer {
  private _server: http.Server;
  private _urlPrefixPrecise: string = '';
  private _urlPrefixHumanReadable: string = '';
  private _port: number = 0;
  private _routes: { prefix?: string, exact?: string, handler: ServerRouteHandler }[] = [];

  constructor() {
    this._server = http.createServer(this._onRequest.bind(this));
    decorateServer(this._server);
  }

  server() {
    return this._server;
  }

  routePrefix(prefix: string, handler: ServerRouteHandler) {
    this._routes.push({ prefix, handler });
  }

  routePath(path: string, handler: ServerRouteHandler) {
    this._routes.push({ exact: path, handler });
  }

  port(): number {
    return this._port;
  }

  private async _tryStart(port: number | undefined, host: string) {
    const errorPromise = new ManualPromise();
    const errorListener = (error: Error) => errorPromise.reject(error);
    this._server.on('error', errorListener);

    try {
      this._server.listen(port, host);
      await Promise.race([
        new Promise(cb => this._server!.once('listening', cb)),
        errorPromise,
      ]);
    } finally {
      this._server.removeListener('error', errorListener);
    }
  }

  async start(options: { port?: number, preferredPort?: number, host?: string } = {}): Promise<void> {
    const host = options.host || 'localhost';
    if (options.preferredPort) {
      try {
        await this._tryStart(options.preferredPort, host);
      } catch (e: any) {
        if (!e || !e.message || !e.message.includes('EADDRINUSE'))
          throw e;
        await this._tryStart(undefined, host);
      }
    } else {
      await this._tryStart(options.port, host);
    }

    const address = this._server.address();
    if (typeof address === 'string') {
      this._urlPrefixPrecise = address;
      this._urlPrefixHumanReadable = address;
    } else {
      this._port = address!.port;
      const resolvedHost = address!.family === 'IPv4' ? address!.address : `[${address!.address}]`;
      this._urlPrefixPrecise = `http://${resolvedHost}:${address!.port}`;
      this._urlPrefixHumanReadable = `http://${host}:${address!.port}`;
    }
  }

  async stop() {
    await new Promise(cb => this._server!.close(cb));
  }

  urlPrefix(purpose: 'human-readable' | 'precise'): string {
    return purpose === 'human-readable' ? this._urlPrefixHumanReadable : this._urlPrefixPrecise;
  }

  serveFile(request: http.IncomingMessage, response: http.ServerResponse, absoluteFilePath: string, headers?: { [name: string]: string }): boolean {
    try {
      for (const [name, value] of Object.entries(headers || {}))
        response.setHeader(name, value);
      if (request.headers.range)
        this._serveRangeFile(request, response, absoluteFilePath);
      else
        this._serveFile(response, absoluteFilePath);
      return true;
    } catch (e) {
      return false;
    }
  }

  _serveFile(response: http.ServerResponse, absoluteFilePath: string) {
    const content = fs.readFileSync(absoluteFilePath);
    response.statusCode = 200;
    const contentType = mime.getType(path.extname(absoluteFilePath)) || 'application/octet-stream';
    response.setHeader('Content-Type', contentType);
    response.setHeader('Content-Length', content.byteLength);
    response.end(content);
  }

  _serveRangeFile(request: http.IncomingMessage, response: http.ServerResponse, absoluteFilePath: string) {
    const range = request.headers.range;
    if (!range || !range.startsWith('bytes=') || range.includes(', ') || [...range].filter(char => char === '-').length !== 1) {
      response.statusCode = 400;
      return response.end('Bad request');
    }

    // Parse the range header: https://datatracker.ietf.org/doc/html/rfc7233#section-2.1
    const [startStr, endStr] = range.replace(/bytes=/, '').split('-');

    // Both start and end (when passing to fs.createReadStream) and the range header are inclusive and start counting at 0.
    let start: number;
    let end: number;
    const size = fs.statSync(absoluteFilePath).size;
    if (startStr !== '' && endStr === '') {
      // No end specified: use the whole file
      start = +startStr;
      end = size - 1;
    } else if (startStr === '' && endStr !== '') {
      // No start specified: calculate start manually
      start = size - +endStr;
      end = size - 1;
    } else {
      start = +startStr;
      end = +endStr;
    }

    // Handle unavailable range request
    if (Number.isNaN(start) || Number.isNaN(end) || start >= size || end >= size || start > end) {
      // Return the 416 Range Not Satisfiable: https://datatracker.ietf.org/doc/html/rfc7233#section-4.4
      response.writeHead(416, {
        'Content-Range': `bytes */${size}`
      });
      return response.end();
    }

    // Sending Partial Content: https://datatracker.ietf.org/doc/html/rfc7233#section-4.1
    response.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${size}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': end - start + 1,
      'Content-Type': mime.getType(path.extname(absoluteFilePath))!,
    });

    const readable = fs.createReadStream(absoluteFilePath, { start, end });
    readable.pipe(response);
  }

  private _onRequest(request: http.IncomingMessage, response: http.ServerResponse) {
    if (request.method === 'OPTIONS') {
      response.writeHead(200);
      response.end();
      return;
    }

    request.on('error', () => response.end());
    try {
      if (!request.url) {
        response.end();
        return;
      }
      const url = new URL('http://localhost' + request.url);
      for (const route of this._routes) {
        if (route.exact && url.pathname === route.exact) {
          route.handler(request, response);
          return;
        }
        if (route.prefix && url.pathname.startsWith(route.prefix)) {
          route.handler(request, response);
          return;
        }
      }
      response.statusCode = 404;
      response.end();
    } catch (e) {
      response.end();
    }
  }
}

function decorateServer(server: net.Server) {
  const sockets = new Set<net.Socket>();
  server.on('connection', socket => {
    sockets.add(socket);
    socket.once('close', () => sockets.delete(socket));
  });

  const close = server.close;
  server.close = (callback?: (err?: Error) => void) => {
    for (const socket of sockets)
      socket.destroy();
    sockets.clear();
    return close.call(server, callback);
  };
}
