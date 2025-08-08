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

// Regex constants for performance optimization
const CREATE_HTTP_SESSION_REGEX = /create http session/;
const DELETE_HTTP_SESSION_REGEX = /delete http session/;
const CREATE_CONTEXT_REGEX = /create context/;
const CLOSE_CONTEXT_REGEX = /close context/;
const CREATE_BROWSER_CONTEXT_ISOLATED_REGEX =
  /create browser context \(isolated\)/;
const CLOSE_BROWSER_CONTEXT_ISOLATED_REGEX =
  /close browser context \(isolated\)/;
const CREATE_BROWSER_CONTEXT_PERSISTENT_REGEX =
  /create browser context \(persistent\)/;
const CLOSE_BROWSER_CONTEXT_PERSISTENT_REGEX =
  /close browser context \(persistent\)/;
const OBTAIN_BROWSER_ISOLATED_REGEX = /obtain browser \(isolated\)/;
const CLOSE_BROWSER_ISOLATED_REGEX = /close browser \(isolated\)/;
const LOCK_USER_DATA_DIR_REGEX = /lock user data dir/;
const RELEASE_USER_DATA_DIR_REGEX = /release user data dir/;
const LISTENING_URL_REGEX = /Listening on (http:\/\/.*)/;

// NOTE: Can be removed when we drop Node.js 18 support and changed to import.meta.filename.
const __filename = nodeUrl.fileURLToPath(import.meta.url);

// Helper function to check browser lifecycle assertions
interface BrowserLifecycleExpectations {
  httpSessions: number;
  contexts: number;
  browserContextType: 'isolated' | 'persistent';
  obtainBrowser?: number;
  closeBrowser?: number;
  userDataDir?: number;
}

function expectBrowserLifecycle(
  stderr: () => string,
  expectations: BrowserLifecycleExpectations
): void {
  const lines = stderr().split('\n');

  // HTTP session assertions
  expect(
    lines.filter((line) => line.match(CREATE_HTTP_SESSION_REGEX)).length
  ).toBe(expectations.httpSessions);
  expect(
    lines.filter((line) => line.match(DELETE_HTTP_SESSION_REGEX)).length
  ).toBe(expectations.httpSessions);

  // Context assertions
  expect(lines.filter((line) => line.match(CREATE_CONTEXT_REGEX)).length).toBe(
    expectations.contexts
  );
  expect(lines.filter((line) => line.match(CLOSE_CONTEXT_REGEX)).length).toBe(
    expectations.contexts
  );

  // Browser context type-specific assertions
  if (expectations.browserContextType === 'isolated') {
    expect(
      lines.filter((line) => line.match(CREATE_BROWSER_CONTEXT_ISOLATED_REGEX))
        .length
    ).toBe(expectations.contexts);
    expect(
      lines.filter((line) => line.match(CLOSE_BROWSER_CONTEXT_ISOLATED_REGEX))
        .length
    ).toBe(expectations.contexts);

    // Browser isolation assertions (optional)
    if (expectations.obtainBrowser !== undefined) {
      expect(
        lines.filter((line) => line.match(OBTAIN_BROWSER_ISOLATED_REGEX)).length
      ).toBe(expectations.obtainBrowser);
    }
    if (expectations.closeBrowser !== undefined) {
      expect(
        lines.filter((line) => line.match(CLOSE_BROWSER_ISOLATED_REGEX)).length
      ).toBe(expectations.closeBrowser);
    }
  } else if (expectations.browserContextType === 'persistent') {
    expect(
      lines.filter((line) =>
        line.match(CREATE_BROWSER_CONTEXT_PERSISTENT_REGEX)
      ).length
    ).toBe(expectations.contexts);
    expect(
      lines.filter((line) => line.match(CLOSE_BROWSER_CONTEXT_PERSISTENT_REGEX))
        .length
    ).toBe(expectations.contexts);

    // User data directory assertions (optional)
    if (expectations.userDataDir !== undefined) {
      expect(
        lines.filter((line) => line.match(LOCK_USER_DATA_DIR_REGEX)).length
      ).toBe(expectations.userDataDir);
      expect(
        lines.filter((line) => line.match(RELEASE_USER_DATA_DIR_REGEX)).length
      ).toBe(expectations.userDataDir);
    }
  }
}

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
  const transport = new StreamableHTTPClientTransport(new URL('/mcp', url));
  const client = new Client({ name: 'test', version: '1.0.0' });
  await client.connect(transport);
  await client.ping();
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
  const transport = new StreamableHTTPClientTransport(new URL('/mcp', url));
  const client = new Client({ name: 'test', version: '1.0.0' });
  await client.connect(transport);
  await client.ping();
});

test('http transport browser lifecycle (isolated)', async ({
  serverEndpoint,
  server,
}) => {
  const { url, stderr } = await serverEndpoint({ args: ['--isolated'] });

  const transport1 = new StreamableHTTPClientTransport(new URL('/mcp', url));
  const client1 = new Client({ name: 'test', version: '1.0.0' });
  await client1.connect(transport1);
  await client1.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  });
  /**
   * src/client/streamableHttp.ts
   * Clients that no longer need a particular session
   * (e.g., because the user is leaving the client application) SHOULD send an
   * HTTP DELETE to the MCP endpoint with the Mcp-Session-Id header to explicitly
   * terminate the session.
   */
  await transport1.terminateSession();
  await client1.close();

  const transport2 = new StreamableHTTPClientTransport(new URL('/mcp', url));
  const client2 = new Client({ name: 'test', version: '1.0.0' });
  await client2.connect(transport2);
  await client2.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  });
  await transport2.terminateSession();
  await client2.close();

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

  const transport1 = new StreamableHTTPClientTransport(new URL('/mcp', url));
  const client1 = new Client({ name: 'test', version: '1.0.0' });
  await client1.connect(transport1);
  await client1.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  });

  const transport2 = new StreamableHTTPClientTransport(new URL('/mcp', url));
  const client2 = new Client({ name: 'test', version: '1.0.0' });
  await client2.connect(transport2);
  await client2.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  });
  await transport1.terminateSession();
  await client1.close();

  const transport3 = new StreamableHTTPClientTransport(new URL('/mcp', url));
  const client3 = new Client({ name: 'test', version: '1.0.0' });
  await client3.connect(transport3);
  await client3.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  });

  await transport2.terminateSession();
  await client2.close();
  await transport3.terminateSession();
  await client3.close();

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

  const transport1 = new StreamableHTTPClientTransport(new URL('/mcp', url));
  const client1 = new Client({ name: 'test', version: '1.0.0' });
  await client1.connect(transport1);
  await client1.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  });
  await transport1.terminateSession();
  await client1.close();

  const transport2 = new StreamableHTTPClientTransport(new URL('/mcp', url));
  const client2 = new Client({ name: 'test', version: '1.0.0' });
  await client2.connect(transport2);
  await client2.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  });
  await transport2.terminateSession();
  await client2.close();

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

  const transport1 = new StreamableHTTPClientTransport(new URL('/mcp', url));
  const client1 = new Client({ name: 'test', version: '1.0.0' });
  await client1.connect(transport1);
  await client1.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  });

  const transport2 = new StreamableHTTPClientTransport(new URL('/mcp', url));
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

test('http transport (default)', async ({ serverEndpoint }) => {
  const { url } = await serverEndpoint();
  const transport = new StreamableHTTPClientTransport(url);
  const client = new Client({ name: 'test', version: '1.0.0' });
  await client.connect(transport);
  await client.ping();
  expect(transport.sessionId, 'has session support').toBeDefined();
});
