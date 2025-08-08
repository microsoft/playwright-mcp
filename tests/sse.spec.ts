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
import url from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import type { Config } from '../config.d.ts';
import { test as baseTest, expect } from './fixtures.js';

// Top-level regex patterns for performance optimization
const LISTENING_ON_REGEX = /Listening on (http:\/\/.*)/;
const CREATE_SSE_SESSION_REGEX = /create SSE session/;
const DELETE_SSE_SESSION_REGEX = /delete SSE session/;
const CREATE_CONTEXT_REGEX = /create context/;
const CLOSE_CONTEXT_REGEX = /close context/;
const CREATE_BROWSER_CONTEXT_ISOLATED_REGEX =
  /create browser context \(isolated\)/;
const CLOSE_BROWSER_CONTEXT_ISOLATED_REGEX =
  /close browser context \(isolated\)/;
const OBTAIN_BROWSER_ISOLATED_REGEX = /obtain browser \(isolated\)/;
const CLOSE_BROWSER_ISOLATED_REGEX = /close browser \(isolated\)/;
const CREATE_BROWSER_CONTEXT_PERSISTENT_REGEX =
  /create browser context \(persistent\)/;
const CLOSE_BROWSER_CONTEXT_PERSISTENT_REGEX =
  /close browser context \(persistent\)/;
const LOCK_USER_DATA_DIR_REGEX = /lock user data dir/;
const RELEASE_USER_DATA_DIR_REGEX = /release user data dir/;

// NOTE: Can be removed when we drop Node.js 18 support and changed to import.meta.filename.
const __filename = url.fileURLToPath(import.meta.url);

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
      const url = await new Promise<string>((resolve) =>
        cp?.stderr?.on('data', (data) => {
          stderr += data.toString();
          const match = stderr.match(LISTENING_ON_REGEX);
          if (match) {
            resolve(match[1]);
          }
        })
      );

      return { url: new URL(url), stderr: () => stderr };
    });
    cp?.kill('SIGTERM');
  },
});

test('sse transport', async ({ serverEndpoint }) => {
  const { url } = await serverEndpoint();
  const transport = new SSEClientTransport(new URL('/sse', url));
  const client = new Client({ name: 'test', version: '1.0.0' });
  await client.connect(transport);
  await client.ping();
});

test('sse transport (config)', async ({ serverEndpoint }) => {
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
  const transport = new SSEClientTransport(new URL('/sse', url));
  const client = new Client({ name: 'test', version: '1.0.0' });
  await client.connect(transport);
  await client.ping();
});

test('sse transport browser lifecycle (isolated)', async ({
  serverEndpoint,
  server,
}) => {
  const { url, stderr } = await serverEndpoint({ args: ['--isolated'] });

  const transport1 = new SSEClientTransport(new URL('/sse', url));
  const client1 = new Client({ name: 'test', version: '1.0.0' });
  await client1.connect(transport1);
  await client1.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  });
  await client1.close();

  const transport2 = new SSEClientTransport(new URL('/sse', url));
  const client2 = new Client({ name: 'test', version: '1.0.0' });
  await client2.connect(transport2);
  await client2.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  });
  await client2.close();

  await expect(async () => {
    const lines = stderr().split('\n');
    expect(
      lines.filter((line) => line.match(CREATE_SSE_SESSION_REGEX)).length
    ).toBe(2);
    expect(
      lines.filter((line) => line.match(DELETE_SSE_SESSION_REGEX)).length
    ).toBe(2);

    expect(
      lines.filter((line) => line.match(CREATE_CONTEXT_REGEX)).length
    ).toBe(2);
    expect(lines.filter((line) => line.match(CLOSE_CONTEXT_REGEX)).length).toBe(
      2
    );

    expect(
      lines.filter((line) => line.match(CREATE_BROWSER_CONTEXT_ISOLATED_REGEX))
        .length
    ).toBe(2);
    expect(
      lines.filter((line) => line.match(CLOSE_BROWSER_CONTEXT_ISOLATED_REGEX))
        .length
    ).toBe(2);

    expect(
      lines.filter((line) => line.match(OBTAIN_BROWSER_ISOLATED_REGEX)).length
    ).toBe(2);
    expect(
      lines.filter((line) => line.match(CLOSE_BROWSER_ISOLATED_REGEX)).length
    ).toBe(2);
  }).toPass();
});

test('sse transport browser lifecycle (isolated, multiclient)', async ({
  serverEndpoint,
  server,
}) => {
  const { url, stderr } = await serverEndpoint({ args: ['--isolated'] });

  const transport1 = new SSEClientTransport(new URL('/sse', url));
  const client1 = new Client({ name: 'test', version: '1.0.0' });
  await client1.connect(transport1);
  await client1.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  });

  const transport2 = new SSEClientTransport(new URL('/sse', url));
  const client2 = new Client({ name: 'test', version: '1.0.0' });
  await client2.connect(transport2);
  await client2.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  });
  await client1.close();

  const transport3 = new SSEClientTransport(new URL('/sse', url));
  const client3 = new Client({ name: 'test', version: '1.0.0' });
  await client3.connect(transport3);
  await client3.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  });

  await client2.close();
  await client3.close();

  await expect(async () => {
    const lines = stderr().split('\n');
    expect(
      lines.filter((line) => line.match(CREATE_SSE_SESSION_REGEX)).length
    ).toBe(3);
    expect(
      lines.filter((line) => line.match(DELETE_SSE_SESSION_REGEX)).length
    ).toBe(3);

    expect(
      lines.filter((line) => line.match(CREATE_CONTEXT_REGEX)).length
    ).toBe(3);
    expect(lines.filter((line) => line.match(CLOSE_CONTEXT_REGEX)).length).toBe(
      3
    );

    expect(
      lines.filter((line) => line.match(CREATE_BROWSER_CONTEXT_ISOLATED_REGEX))
        .length
    ).toBe(3);
    expect(
      lines.filter((line) => line.match(CLOSE_BROWSER_CONTEXT_ISOLATED_REGEX))
        .length
    ).toBe(3);

    expect(
      lines.filter((line) => line.match(OBTAIN_BROWSER_ISOLATED_REGEX)).length
    ).toBe(1);
    expect(
      lines.filter((line) => line.match(CLOSE_BROWSER_ISOLATED_REGEX)).length
    ).toBe(1);
  }).toPass();
});

test('sse transport browser lifecycle (persistent)', async ({
  serverEndpoint,
  server,
}) => {
  const { url, stderr } = await serverEndpoint();

  const transport1 = new SSEClientTransport(new URL('/sse', url));
  const client1 = new Client({ name: 'test', version: '1.0.0' });
  await client1.connect(transport1);
  await client1.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  });
  await client1.close();

  const transport2 = new SSEClientTransport(new URL('/sse', url));
  const client2 = new Client({ name: 'test', version: '1.0.0' });
  await client2.connect(transport2);
  await client2.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  });
  await client2.close();

  await expect(async () => {
    const lines = stderr().split('\n');
    expect(
      lines.filter((line) => line.match(CREATE_SSE_SESSION_REGEX)).length
    ).toBe(2);
    expect(
      lines.filter((line) => line.match(DELETE_SSE_SESSION_REGEX)).length
    ).toBe(2);

    expect(
      lines.filter((line) => line.match(CREATE_CONTEXT_REGEX)).length
    ).toBe(2);
    expect(lines.filter((line) => line.match(CLOSE_CONTEXT_REGEX)).length).toBe(
      2
    );

    expect(
      lines.filter((line) =>
        line.match(CREATE_BROWSER_CONTEXT_PERSISTENT_REGEX)
      ).length
    ).toBe(2);
    expect(
      lines.filter((line) => line.match(CLOSE_BROWSER_CONTEXT_PERSISTENT_REGEX))
        .length
    ).toBe(2);

    expect(
      lines.filter((line) => line.match(LOCK_USER_DATA_DIR_REGEX)).length
    ).toBe(2);
    expect(
      lines.filter((line) => line.match(RELEASE_USER_DATA_DIR_REGEX)).length
    ).toBe(2);
  }).toPass();
});

test('sse transport browser lifecycle (persistent, multiclient)', async ({
  serverEndpoint,
  server,
}) => {
  const { url } = await serverEndpoint();

  const transport1 = new SSEClientTransport(new URL('/sse', url));
  const client1 = new Client({ name: 'test', version: '1.0.0' });
  await client1.connect(transport1);
  await client1.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  });

  const transport2 = new SSEClientTransport(new URL('/sse', url));
  const client2 = new Client({ name: 'test', version: '1.0.0' });
  await client2.connect(transport2);
  const response = await client2.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  });
  expect(response.isError).toBe(true);
  expect(response.content?.[0].text).toContain(
    'use --isolated to run multiple instances of the same browser'
  );

  await client1.close();
  await client2.close();
});
