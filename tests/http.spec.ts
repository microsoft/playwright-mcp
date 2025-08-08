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

import { type ChildProcess, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import nodeUrl from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { Config } from '../config.d.ts';
import { test as baseTest, expect } from './fixtures.js';
import {
  createHttpClient,
  expectBrowserLifecycle,
  navigateToUrl,
  withHttpClient,
} from './test-helpers.js';

// Regex constants for performance optimization
const LISTENING_URL_REGEX = /Listening on (http:\/\/.*)/;

// NOTE: Can be removed when we drop Node.js 18 support and changed to import.meta.filename.
const __filename = nodeUrl.fileURLToPath(import.meta.url);

// Browser lifecycle expectation type is now imported from test-helpers

const test = baseTest.extend<{
  serverEndpoint: (options?: {
    args?: string[];
    noPort?: boolean;
  }) => Promise<{ url: URL; stderr: () => string }>;
}>({
  serverEndpoint: async ({ mcpHeadless }, use, testInfo) => {
    let cp: ChildProcess | undefined;
    const userDataDir = testInfo.outputPath('user-data-dir');
    await use(async (options?: { args?: string[]; noPort?: boolean }) => {
      if (cp) {
        throw new Error('Process already running');
      }

      cp = spawn(
        'node',
        [
          path.join(path.dirname(__filename), '../cli.js'),
          ...(options?.noPort ? [] : ['--port=0']),
          `--user-data-dir=${userDataDir}`,
          ...(mcpHeadless ? ['--headless'] : []),
          ...(options?.args || []),
        ],
        {
          stdio: 'pipe',
          env: {
            ...process.env,
            DEBUG: 'pw:mcp:test',
            DEBUG_COLORS: '0',
            DEBUG_HIDE_DATE: '1',
          },
        }
      );
      let stderr = '';
      const serverUrl = await new Promise<string>((resolve) =>
        cp?.stderr?.on('data', (data) => {
          stderr += data.toString();
          const match = stderr.match(LISTENING_URL_REGEX);
          if (match) {
            resolve(match[1]);
          }
        })
      );

      return { url: new URL(serverUrl), stderr: () => stderr };
    });
    cp?.kill('SIGTERM');
  },
});

test('http transport', async ({ serverEndpoint }) => {
  const { url } = await serverEndpoint();
  await withHttpClient(url, async (client) => {
    await client.ping();
  });
});

test('http transport (config)', async ({ serverEndpoint }) => {
  const config: Config = {
    server: {
      port: 0,
    },
  };
  const configFile = test.info().outputPath('config.json');
  await fs.promises.writeFile(configFile, JSON.stringify(config, null, 2));

  const { url } = await serverEndpoint({
    noPort: true,
    args: [`--config=${configFile}`],
  });
  await withHttpClient(url, async (client) => {
    await client.ping();
  });
});

test('http transport browser lifecycle (isolated)', async ({
  serverEndpoint,
  server,
}) => {
  const { url, stderr } = await serverEndpoint({ args: ['--isolated'] });

  // First client session
  await withHttpClient(
    url,
    async (client) => {
      await navigateToUrl(client, server.HELLO_WORLD);
    },
    'test1'
  );

  // Second client session
  await withHttpClient(
    url,
    async (client) => {
      await navigateToUrl(client, server.HELLO_WORLD);
    },
    'test2'
  );

  expect(() => {
    expectBrowserLifecycle(stderr, {
      httpSessions: 2,
      contexts: 2,
      browserContextType: 'isolated',
      obtainBrowser: 2,
      closeBrowser: 2,
    });
  }).toPass();
});

test('http transport browser lifecycle (isolated, multiclient)', async ({
  serverEndpoint,
  server,
}) => {
  const { url, stderr } = await serverEndpoint({ args: ['--isolated'] });

  // Start multiple concurrent clients
  const { client: client1, transport: transport1 } = await createHttpClient(
    url,
    'test1'
  );
  const { client: client2, transport: transport2 } = await createHttpClient(
    url,
    'test2'
  );

  // Navigate with both clients
  await navigateToUrl(client1, server.HELLO_WORLD);
  await navigateToUrl(client2, server.HELLO_WORLD);

  // Close first client
  await transport1.terminateSession();
  await client1.close();

  // Start third client
  await withHttpClient(
    url,
    async (client3) => {
      await navigateToUrl(client3, server.HELLO_WORLD);
    },
    'test3'
  );

  // Close remaining client
  await transport2.terminateSession();
  await client2.close();

  expect(() => {
    expectBrowserLifecycle(stderr, {
      httpSessions: 3,
      contexts: 3,
      browserContextType: 'isolated',
      obtainBrowser: 1,
      closeBrowser: 1,
    });
  }).toPass();
});

test('http transport browser lifecycle (persistent)', async ({
  serverEndpoint,
  server,
}) => {
  const { url, stderr } = await serverEndpoint();

  // First client session
  await withHttpClient(
    url,
    async (client) => {
      await navigateToUrl(client, server.HELLO_WORLD);
    },
    'test1'
  );

  // Second client session
  await withHttpClient(
    url,
    async (client) => {
      await navigateToUrl(client, server.HELLO_WORLD);
    },
    'test2'
  );

  expect(() => {
    expectBrowserLifecycle(stderr, {
      httpSessions: 2,
      contexts: 2,
      browserContextType: 'persistent',
      userDataDir: 2,
    });
  }).toPass();
});

test('http transport browser lifecycle (persistent, multiclient)', async ({
  serverEndpoint,
  server,
}) => {
  const { url } = await serverEndpoint();

  const { client: client1, transport: transport1 } = await createHttpClient(
    url,
    'test1'
  );
  await navigateToUrl(client1, server.HELLO_WORLD);

  const { client: client2, transport: transport2 } = await createHttpClient(
    url,
    'test2'
  );
  const response = await navigateToUrl(client2, server.HELLO_WORLD);

  expect(response.isError).toBe(true);
  expect(response.content?.[0].text).toContain(
    'use --isolated to run multiple instances of the same browser'
  );

  await client1.close();
  await client2.close();
});

test('http transport (default)', async ({ serverEndpoint }) => {
  const { url } = await serverEndpoint();
  const transport = new StreamableHTTPClientTransport(url);
  const client = new Client({ name: 'test', version: '1.0.0' });
  await client.connect(transport);
  await client.ping();
  expect(transport.sessionId, 'has session support').toBeDefined();
  await client.close();
});
