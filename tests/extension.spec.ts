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
import url from 'url';
import path from 'path';
import assert from 'assert';
import { spawnSync } from 'child_process';

import { test, expect } from './fixtures.js';

import { createConnection } from '@playwright/mcp';

test.skip(({ mcpMode }) => mcpMode !== 'extension');

test.skip('allow re-connecting to a browser', async ({ client, mcpExtensionPage }) => {
  assert(mcpExtensionPage, 'mcpExtensionPage is required for this test');
  await client.callTool({
    name: 'browser_navigate',
    arguments: {
      url: 'data:text/html,<html><title>Title</title><body>Hello, planet!</body></html>',
    },
  });
  await expect(mcpExtensionPage.page.locator('body')).toHaveText('Hello, planet!');

  expect(await client.callTool({
    name: 'browser_close',
    arguments: {},
  })).toContainTextContent('No open pages available');

  // await mcpExtensionPage.connect();

  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: {
      url: 'data:text/html,<html><title>Title</title><body>Hello, world!</body></html>',
    },
  })).toContainTextContent('Error: Please use browser_connect before launching the browser');
  await mcpExtensionPage.connect();

  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: {
      url: 'data:text/html,<html><title>Title</title><body>Hello, world!</body></html>',
    },
  })).toContainTextContent(`- generic [ref=e1]: Hello, world!`);
  await expect(mcpExtensionPage.page.locator('body')).toHaveText('Hello, world!');
});

test('does not allow --cdp-endpoint', async ({  startClient }) => {
  await expect(createConnection({
    browser: { browserName: 'firefox' },
    extension: true,
  })).rejects.toThrow(/Extension mode is only supported for Chromium browsers/);
});

// NOTE: Can be removed when we drop Node.js 18 support and changed to import.meta.filename.
const __filename = url.fileURLToPath(import.meta.url);

test('does not support --device', async () => {
  const result = spawnSync('node', [
    path.join(__filename, '../../cli.js'), '--device=Pixel 5', '--extension',
  ]);
  expect(result.error).toBeUndefined();
  expect(result.status).toBe(1);
  expect(result.stderr.toString()).toContain('Device emulation is not supported with extension mode.');
});
