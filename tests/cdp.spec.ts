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

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import url from 'node:url';
import { expect, test } from './fixtures.js';

test('cdp server', async ({ cdpServer, startClient, server }) => {
  await cdpServer.start();
  const { client } = await startClient({
    args: [`--cdp-endpoint=${cdpServer.endpoint}`],
  });
  expect(
    await client.callTool({
      name: 'browser_navigate',
      arguments: { url: server.HELLO_WORLD },
    })
  ).toHaveResponse({
    result: undefined,
    code: expect.any(String),
    tabs: expect.any(String),
    pageState: expect.stringContaining(
      '- generic [active] [ref=e1]: Hello, world!'
    ),
    consoleMessages: undefined,
    modalState: undefined,
    downloads: undefined,
    isError: undefined,
    attachments: expect.any(Array),
  });
});

test('cdp server reuse tab', async ({ cdpServer, startClient, server }) => {
  const browserContext = await cdpServer.start();
  const { client } = await startClient({
    args: [`--cdp-endpoint=${cdpServer.endpoint}`],
  });

  const [page] = browserContext.pages();
  await page.goto(server.HELLO_WORLD);

  expect(
    await client.callTool({
      name: 'browser_click',
      arguments: {
        element: 'Hello, world!',
        ref: 'f0',
      },
    })
  ).toHaveResponse({
    result: `Error: No open pages available. Use the "browser_navigate" tool to navigate to a page first.`,
    code: undefined,
    tabs: expect.any(String),
    pageState: undefined,
    consoleMessages: undefined,
    modalState: undefined,
    downloads: undefined,
    isError: true,
    attachments: expect.any(Array),
  });

  expect(
    await client.callTool({
      name: 'browser_snapshot',
      arguments: {
        expectation: {
          includeTabs: false,
          includeCode: false,
        },
      },
    })
  ).toHaveResponse({
    result: undefined,
    code: undefined,
    tabs: undefined,
    pageState: expect.stringContaining(`- **Page URL:** ${server.HELLO_WORLD}
- **Page Title:** Title
- Page Snapshot:
\`\`\`yaml
- generic [active] [ref=e1]: Hello, world!
\`\`\``),
    consoleMessages: undefined,
    modalState: undefined,
    downloads: undefined,
    isError: undefined,
    attachments: expect.any(Array),
  });
});

test('should throw connection error and allow re-connecting', async ({
  cdpServer,
  startClient,
  server,
}) => {
  const { client } = await startClient({
    args: [`--cdp-endpoint=${cdpServer.endpoint}`],
  });

  server.setContent(
    '/',
    `
    <title>Title</title>
    <body>Hello, world!</body>
  `,
    'text/html'
  );

  expect(
    await client.callTool({
      name: 'browser_navigate',
      arguments: { url: server.PREFIX },
    })
  ).toHaveResponse({
    result: expect.stringContaining(
      'Error: browserType.connectOverCDP: connect ECONNREFUSED'
    ),
    code: undefined,
    tabs: expect.any(String),
    pageState: undefined,
    consoleMessages: undefined,
    modalState: undefined,
    downloads: undefined,
    isError: true,
    attachments: expect.any(Array),
  });
  await cdpServer.start();
  expect(
    await client.callTool({
      name: 'browser_navigate',
      arguments: { url: server.PREFIX },
    })
  ).toHaveResponse({
    result: undefined,
    code: expect.any(String),
    tabs: expect.any(String),
    pageState: expect.stringContaining(
      '- generic [active] [ref=e1]: Hello, world!'
    ),
    consoleMessages: undefined,
    modalState: undefined,
    downloads: undefined,
    isError: undefined,
    attachments: expect.any(Array),
  });
});

// NOTE: Can be removed when we drop Node.js 18 support and changed to import.meta.filename.
const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('does not support --device', () => {
  // Execute CLI using spawnSync for security (no shell injection)
  const result = spawnSync(
    process.execPath,
    [
      path.join(__dirname, '../cli.js'),
      '--device=Pixel 5',
      '--cdp-endpoint=http://localhost:1234',
    ],
    {
      env: { NODE_ENV: 'test' },
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 10_000,
    }
  );
  expect(result.error).toBeUndefined();
  expect(result.status).toBe(1);
  expect(result.stderr.toString()).toContain(
    'Device emulation is not supported with cdpEndpoint.'
  );
});
