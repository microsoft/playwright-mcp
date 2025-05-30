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
import fs from 'node:fs';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';

import { test as baseTest, expect } from './fixtures.js';

// NOTE: Can be removed when we drop Node.js 18 support and changed to import.meta.filename.
const __filename = url.fileURLToPath(import.meta.url);

const test = baseTest.extend<{ serverEndpoint: URL }>({
  serverEndpoint: async ({}, use, testInfo) => {
    const msPlaywrightDir = testInfo.outputPath('ms-playwright');
    await fs.promises.mkdir(msPlaywrightDir, { recursive: true });
    const cp = spawn(
        'node',
        [path.join(path.dirname(__filename), '../cli.js'), '--port', '0'],
        {
          stdio: 'pipe',
          env: {
            ...process.env,
            PW_MS_PLAYWRIGHT_DIR: msPlaywrightDir,
          }
        }
    );
    try {
      let stderr = '';
      const url = await new Promise<URL>(resolve => cp.stderr?.on('data', data => {
        stderr += data.toString();
        try {
          const config = JSON.parse(stderr.slice(stderr.indexOf('{'), stderr.lastIndexOf('}') + 1));
          resolve(new URL(config.mcpServers.playwright.url));
        } catch {}
      }));

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
  await client.close();
});

test('sse transport without secret', async ({ serverEndpoint }) => {
  serverEndpoint.searchParams.delete('secret');
  const transport = new SSEClientTransport(serverEndpoint);
  const client = new Client({ name: 'test', version: '1.0.0' });
  await expect(client.connect(transport)).rejects.toThrow();
});

test('streamable http transport', async ({ serverEndpoint }) => {
  serverEndpoint.pathname = '/mcp';
  const transport = new StreamableHTTPClientTransport(serverEndpoint);
  const client = new Client({ name: 'test', version: '1.0.0' });
  await client.connect(transport);
  await client.ping();
  expect(transport.sessionId, 'has session support').toBeDefined();
});

test('streamable http transport without secret', async ({ serverEndpoint }) => {
  serverEndpoint.pathname = '/mcp';
  serverEndpoint.searchParams.delete('secret');
  const transport = new StreamableHTTPClientTransport(serverEndpoint);
  const client = new Client({ name: 'test', version: '1.0.0' });
  await expect(client.connect(transport)).rejects.toThrow();
});
