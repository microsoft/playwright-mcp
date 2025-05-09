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

import url from 'node:url';
import http from 'node:http';
import { spawn } from 'node:child_process';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';

import { createConnection } from '@playwright/mcp';

import { test as baseTest, expect } from './fixtures.js';

// NOTE: Can be removed when we drop Node.js 18 support and changed to import.meta.filename.
const __filename = url.fileURLToPath(import.meta.url);

const test = baseTest.extend<{ serverEndpoint: string }>({
  serverEndpoint: async ({}, use) => {
    const cp = spawn('node', [path.join(path.dirname(__filename), '../cli.js'), '--port', '0'], { stdio: 'pipe' });
    try {
      let stdout = '';
      const url = await new Promise<string>(resolve => cp.stdout?.on('data', data => {
        stdout += data.toString();
        const match = stdout.match(/Listening on (http:\/\/.*)/);
        if (match)
          resolve(match[1]);
      }));

      await use(url);
    } finally {
      cp.kill();
    }
  },
});

test('sse transport', async ({ serverEndpoint }) => {
  const transport = new SSEClientTransport(new URL(serverEndpoint));
  const client = new Client({ name: 'test', version: '1.0.0' });
  await client.connect(transport);
  await client.ping();
});

test('streamable http transport', async ({ serverEndpoint }) => {
  const transport = new StreamableHTTPClientTransport(new URL('/mcp', serverEndpoint));
  const client = new Client({ name: 'test', version: '1.0.0' });
  await client.connect(transport);
  await client.ping();
  expect(transport.sessionId, 'has session support').toBeDefined();
});

test('sse transport via public API', async ({ server }) => {
  const sessions = new Map<string, SSEServerTransport>();
  const mcpServer = http.createServer(async (req, res) => {
    if (req.method === 'GET') {
      const connection = await createConnection({ browser: { launchOptions: { headless: true } } });
      const transport = new SSEServerTransport('/sse', res);
      sessions.set(transport.sessionId, transport);
      await connection.connect(transport);
    } else if (req.method === 'POST') {
      const url = new URL(`http://localhost${req.url}`);
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
      void transport.handlePostMessage(req, res);
    }
  });
  await new Promise<void>(resolve => mcpServer.listen(0, () => resolve()));
  const serverUrl = `http://localhost:${(mcpServer.address() as AddressInfo).port}/sse`;
  const transport = new SSEClientTransport(new URL(serverUrl));
  const client = new Client({ name: 'test', version: '1.0.0' });
  await client.connect(transport);
  await client.ping();
  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  })).toContainTextContent(`- generic [ref=e1]: Hello, world!`);
  await client.close();
  mcpServer.close();
});
