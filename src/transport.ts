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

import http from 'node:http';
import assert from 'node:assert';
import crypto from 'node:crypto';

import { ServerList } from './server';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

export async function startStdioTransport(serverList: ServerList) {
  const server = await serverList.create();
  await server.connect(new StdioServerTransport());
}

export async function startHttpTransport(port: number, hostname: string | undefined, serverList: ServerList) {
  const sseSessions = new Map<string, SSEServerTransport>();
  async function handleSSE(req: http.IncomingMessage, res: http.ServerResponse, url: URL) {
    if (req.method === 'POST') {
      const sessionId = url.searchParams.get('sessionId');
      if (!sessionId) {
        res.statusCode = 400;
        return res.end('Missing sessionId');
      }

      const transport = sseSessions.get(sessionId);
      if (!transport) {
        res.statusCode = 404;
        return res.end('Session not found');
      }

      return await transport.handlePostMessage(req, res);
    } else if (req.method === 'GET') {
      const transport = new SSEServerTransport('/sse', res);
      sseSessions.set(transport.sessionId, transport);
      const server = await serverList.create();
      res.on('close', () => {
        sseSessions.delete(transport.sessionId);
        serverList.close(server).catch(e => console.error(e));
      });
      return await server.connect(transport);
    }

    res.statusCode = 405;
    res.end('Method not allowed');
  }

  const streamableSessions = new Map<string, StreamableHTTPServerTransport>();
  async function handleStreamable(req: http.IncomingMessage, res: http.ServerResponse, url: URL) {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    if (sessionId) {
      const transport = streamableSessions.get(sessionId);
      if (!transport) {
        res.statusCode = 404;
        res.end('Session not found');
        return;
      }
      return await transport.handleRequest(req, res);
    }

    if (req.method === 'POST') {
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => crypto.randomUUID(),
        onsessioninitialized: sessionId => {
          streamableSessions.set(sessionId, transport);
        }
      });
      transport.onclose = () => {
        if (transport.sessionId)
          streamableSessions.delete(transport.sessionId);
      };
      const server = await serverList.create();
      await server.connect(transport);
      return await transport.handleRequest(req, res);
    }

    res.statusCode = 400;
    res.end('Invalid request');
  }


  const httpServer = http.createServer(async (req, res) => {
    const url = new URL(`http://localhost${req.url}`);
    if (url.pathname.startsWith('/mcp'))
      await handleStreamable(req, res, url);
    else
      await handleSSE(req, res, url);
  });
  httpServer.listen(port, hostname, () => {
    const address = httpServer.address();
    assert(address, 'Could not bind server socket');
    let url: string;
    if (typeof address === 'string') {
      url = address;
    } else {
      const resolvedPort = address.port;
      let resolvedHost = address.family === 'IPv4' ? address.address : `[${address.address}]`;
      if (resolvedHost === '0.0.0.0' || resolvedHost === '[::]')
        resolvedHost = 'localhost';
      url = `http://${resolvedHost}:${resolvedPort}`;
    }
    console.log(`Listening on ${url}`);
    console.log('Put this in your client config:');
    console.log(JSON.stringify({
      'mcpServers': {
        'playwright': {
          'url': `${url}/sse`
        }
      }
    }, undefined, 2));
    console.log('If your client supports streamable HTTP, you can use the /mcp endpoint instead.');
  });
}
