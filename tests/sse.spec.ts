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
import { spawn } from 'node:child_process';
import path from 'node:path';
import { test as baseTest } from './fixtures.js';
import { expect } from 'playwright/test';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

// NOTE: Can be removed when we drop Node.js 18 support and changed to import.meta.filename.
const __filename = url.fileURLToPath(import.meta.url);

const test = baseTest.extend<{ serverEndpoint: URL }>({
  serverEndpoint: async ({}, use) => {
    const cp = spawn('node', [path.join(path.dirname(__filename), '../cli.js'), '--port', '0', '--secret', 'mySecretValue'], { stdio: 'pipe' });
    try {
      let stdout = '';
      const url = await new Promise<URL>(resolve => cp.stdout?.on('data', data => {
        stdout += data.toString();
        const match = stdout.match(/Listening on (http:\/\/.*)/);
        if (match) {
          const baseURL = new URL(match[1]);
          baseURL.searchParams.set('secret', 'mySecretValue');
          resolve(baseURL);
        }
      }));

      cp.stderr.pipe(process.stderr);
      cp.stdout.pipe(process.stdout);

      await use(url);
    } finally {
      cp.kill();
    }
  },
});

test('sse transport', async ({ serverEndpoint }) => {
  const transport = new SSEClientTransport(serverEndpoint);
  const client = new Client({ name: 'test', version: '1.0.0' });
  await client.connect(transport);
  await client.ping();
});

test('sse transport auth', async ({ serverEndpoint }) => {
  serverEndpoint.searchParams.delete('secret');
  const transport = new SSEClientTransport(serverEndpoint);
  const client = new Client({ name: 'test', version: '1.0.0' });
  await expect(() => client.connect(transport)).rejects.toThrow(/403/);
});

test('streamable http transport', async ({ serverEndpoint }) => {
  serverEndpoint.pathname = '/mcp';
  const transport = new StreamableHTTPClientTransport(serverEndpoint);
  const client = new Client({ name: 'test', version: '1.0.0' });
  await client.connect(transport);
  await client.ping();
  expect(transport.sessionId, 'has session support').toBeDefined();
});

test('streamable http transport auth', async ({ serverEndpoint }) => {
  serverEndpoint.pathname = '/mcp';
  serverEndpoint.searchParams.delete('secret');
  const transport = new StreamableHTTPClientTransport(serverEndpoint);
  const client = new Client({ name: 'test', version: '1.0.0' });
  await expect(() => client.connect(transport)).rejects.toThrow(/403/);
});
