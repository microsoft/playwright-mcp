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

import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { createConnection } from './connection.js';

import type { Config } from '../config.js';
import type { Connection } from './connection.js';

export async function startStdioTransport(config: Config, connectionList: Connection[]) {
  const connection = await createConnection(config);
  await connection.connect(new StdioServerTransport());
  connectionList.push(connection);
}

async function handleSSE(config: Config, req: http.IncomingMessage, res: http.ServerResponse, url: URL, sessions: Map<string, SSEServerTransport>, connectionList: Connection[]) {
  if (req.method === 'POST') {
    const sessionId = url.searchParams.get('sessionId');
    if (!sessionId) {
      res.statusCode = 400;
      return res.end('Missing sessionId');
    }

    const transport = sessions.get(sessionId);
    if (!transport) {
      res.statusCode = 404;
      return res.end('Session not found');
    }

    return await transport.handlePostMessage(req, res);
  } else if (req.method === 'GET') {
    const transport = new SSEServerTransport('/sse', res);
    sessions.set(transport.sessionId, transport);
    const connection = await createConnection(config);
    await connection.connect(transport);
    connectionList.push(connection);
    res.on('close', () => {
      sessions.delete(transport.sessionId);
      connection.close().catch(e => {
        // eslint-disable-next-line no-console
        console.error(e);
      });
    });
    return;
  }

  res.statusCode = 405;
  res.end('Method not allowed');
}

async function handleStreamable(config: Config, req: http.IncomingMessage, res: http.ServerResponse, sessions: Map<string, StreamableHTTPServerTransport>, connectionList: Connection[]) {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;
  if (sessionId) {
    const transport = sessions.get(sessionId);
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
        sessions.set(sessionId, transport);
      }
    });
    transport.onclose = () => {
      if (transport.sessionId)
        sessions.delete(transport.sessionId);
    };
    const connection = await createConnection(config);
    connectionList.push(connection);
    await Promise.all([
      connection.connect(transport),
      transport.handleRequest(req, res),
    ]);
    return;
  }

  res.statusCode = 400;
  res.end('Invalid request');
}

export function startHttpTransport(config: Config, port: number, hostname: string | undefined, connectionList: Connection[]) {
  const sseSessions = new Map<string, SSEServerTransport>();
  const streamableSessions = new Map<string, StreamableHTTPServerTransport>();
  const httpServer = http.createServer(async (req, res) => {
    const url = new URL(`http://localhost${req.url}`);
    if (url.pathname.startsWith('/mcp'))
      await handleStreamable(config, req, res, streamableSessions, connectionList);
    else
      await handleSSE(config, req, res, url, sseSessions, connectionList);
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
    const message = [
      `Listening on ${url}`,
      'Put this in your client config:',
      JSON.stringify({
        'mcpServers': {
          'playwright': {
            'url': `${url}/sse`
          }
        }
      }, undefined, 2),
      'If your client supports streamable HTTP, you can use the /mcp endpoint instead.',
    ].join('\n');
    // eslint-disable-next-line no-console
    console.log(message);
  });
}
