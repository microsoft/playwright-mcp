/**
 * Copyright (c) Microsoft Corporation.
 * Modified by Limetest.
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

// --- Removed Tests ---
// The following tests were removed as they target core browser functionalities
// which are now tested directly in tests/core.spec.ts:
// - test browser_navigate
// - test browser_click
// - test reopen browser
// - test single option
// - test multiple option
// - test browser://console (content verification moved to core.spec.ts)
// - test stitched aria frames
// - test browser_choose_file

import { spawn } from 'node:child_process';
import path from 'node:path';
import { test, expect } from './fixtures';

test('test tool list', async ({ client }) => {
  const { tools } = await client.listTools();
  expect(tools.map(t => t.name)).toEqual([
    'browser_endtoend',
  ]);
});

test('test resources list', async ({ client }) => {
  const { resources } = await client.listResources();
  expect(resources).toEqual([
    expect.objectContaining({
      uri: 'browser://console',
      mimeType: 'text/plain',
    }),
  ]);
});

test('sse transport', async () => {
  const cp = spawn('node', [path.join(__dirname, '../packages/mcp/cli.js'), '--port', '0'], { stdio: 'pipe' });
  try {
    let stdout = '';
    const url = await new Promise<string>(resolve => cp.stdout?.on('data', data => {
      stdout += data.toString();
      const match = stdout.match(/Listening on (http:\/\/.*)/);
      if (match)
        resolve(match[1]);
    }));

    const { SSEClientTransport } = await import('@modelcontextprotocol/sdk/client/sse.js');
    const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
    const transport = new SSEClientTransport(new URL(url));
    const client = new Client({ name: 'test', version: '1.0.0' });
    await client.connect(transport);
    await client.ping();
  } finally {
    cp.kill();
  }
});

test('cdp server', async ({ cdpEndpoint, startClient }) => {
  const client = await startClient({ args: [`--cdp-endpoint=${cdpEndpoint}`] });
  const { tools } = await client.listTools();
  expect(tools.map(t => t.name)).toEqual([
    'browser_endtoend',
  ]);
});

test.skip('test qa with single url', async ({ client }) => {
  const response = await client.callTool({
    name: 'browser_endtoend',
    arguments: {
      testCases: [
        {
          testDefinition: 'Validate that the read more button opens the blog posts and the content loads',
        },
        {
          testDefinition: 'Validate that the toggle theme can be opened',
          expect: 'The background color of the website should turn to black if white, or turn to white if black'
        },
      ],
      urls: ['http://localhost:3000']
    }
  });

  console.log('response: ', response);
});
