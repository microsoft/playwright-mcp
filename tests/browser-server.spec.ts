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
import path from 'path';
import url from 'node:url';

import { spawn } from 'child_process';
import { test as baseTest, expect } from './fixtures.js';

import type { ChildProcess } from 'child_process';

const __filename = url.fileURLToPath(import.meta.url);

const test = baseTest.extend<{ agentEndpoint: (options?: { args?: string[] }) => Promise<{ url: URL, stdout: () => string }> }>({
  agentEndpoint: async ({}, use) => {
    let cp: ChildProcess | undefined;
    await use(async (options?: { args?: string[] }) => {
      if (cp)
        throw new Error('Process already running');

      cp = spawn('node', [
        path.join(path.dirname(__filename), '../lib/browserServer.js'),
        ...(options?.args || []),
      ], {
        stdio: 'pipe',
        env: {
          ...process.env,
          DEBUG: 'pw:mcp:test',
          DEBUG_COLORS: '0',
          DEBUG_HIDE_DATE: '1',
        },
      });
      let stdout = '';
      const url = await new Promise<string>(resolve => cp!.stdout?.on('data', data => {
        stdout += data.toString();
        const match = stdout.match(/Listening on (http:\/\/.*)/);
        if (match)
          resolve(match[1]);
      }));

      return { url: new URL(url), stdout: () => stdout };
    });
    cp?.kill('SIGTERM');
  },
});

test.skip(({ mcpBrowser }) => mcpBrowser !== 'chrome', 'Agent is CDP-only for now');

test('browser lifecycle', async ({ agentEndpoint, startClient, server }) => {
  const { url: agentUrl } = await agentEndpoint();
  const { client: client1 } = await startClient({ args: ['--browser-agent', agentUrl.toString()] });
  expect(await client1.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  })).toContainTextContent('Hello, world!');

  const { client: client2 } = await startClient({ args: ['--browser-agent', agentUrl.toString()] });
  expect(await client2.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  })).toContainTextContent('Hello, world!');

  await client1.close();
  await client2.close();
});
