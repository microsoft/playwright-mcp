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
import { test, expect } from './fixtures.js';
import { createServer } from '../lib/index.js';
import { spawnSync } from 'child_process';

test.skip(({ mcpExtension }) => !mcpExtension);

test('allow re-connecting to a browser', async ({ client, clientOutputLines, mcpExtensionPage }) => {
  assert(mcpExtensionPage, 'mcpExtensionPage is required for this test');
  await client.callTool({
    name: 'browser_navigate',
    arguments: {
      url: 'data:text/html,<html><title>Title</title><body>Hello, planet!</body></html>',
    },
  });
  await expect(mcpExtensionPage.locator('body')).toHaveText('Hello, planet!');

  expect(await client.callTool({
    name: 'browser_close',
    arguments: {},
  })).toContainTextContent('No open pages available');

  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: {
      url: 'data:text/html,<html><title>Title</title><body>Hello, world!</body></html>',
    },
  })).toContainTextContent('Error: Please use browser_connect before launching the browser');

  const browserConnectCall = client.callTool({
    name: 'browser_connect',
    arguments: {},
  });
  await expect.poll(() => clientOutputLines.filter(line => line.startsWith('open call to: ')), { timeout: test.info().timeout }).toHaveLength(2);
  const openCallURL = clientOutputLines.filter(line => line.startsWith('open call to: '))[1].split('open call to: ')[1];
  await mcpExtensionPage.goto(openCallURL);
  await mcpExtensionPage.getByRole('button', { name: 'Allow Connection' }).click();
  await expect(mcpExtensionPage.getByRole('heading', { name: 'Connection Established' })).toBeVisible();
  await browserConnectCall;

  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: {
      url: 'data:text/html,<html><title>Title</title><body>Hello, world!</body></html>',
    },
  })).toContainTextContent(`- generic [ref=s1e2]: Hello, world!`);
  await expect(mcpExtensionPage.locator('body')).toHaveText('Hello, world!');
});

test('does not allow --cdp-endpoint', async ({  startClient }) => {
  await expect(createServer({
    browser: { browserName: 'chromium', cdpEndpoint: 'ws://localhost:9222' },
    extension: true,
  })).rejects.toThrow(/Extension mode is not supported with cdpEndpoint/);
  await expect(createServer({
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
