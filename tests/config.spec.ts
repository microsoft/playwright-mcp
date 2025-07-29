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

import fs from 'node:fs';

import { Config } from '../config.js';
import { test, expect } from './fixtures.js';

test('config user data dir', async ({ startClient, server, mcpMode }, testInfo) => {
  server.setContent('/', `
    <title>Title</title>
    <body>Hello, world!</body>
  `, 'text/html');

  const config: Config = {
    browser: {
      userDataDir: testInfo.outputPath('user-data-dir'),
    },
  };
  const configPath = testInfo.outputPath('config.json');
  await fs.promises.writeFile(configPath, JSON.stringify(config, null, 2));

  const { client } = await startClient({ args: ['--config', configPath] });
  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  })).toHaveResponse({
    pageState: expect.stringContaining(`Hello, world!`),
  });

  const files = await fs.promises.readdir(config.browser!.userDataDir!);
  expect(files.length).toBeGreaterThan(0);
});

test.describe(() => {
  test.use({ mcpBrowser: '' });
  test('browserName', { annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright-mcp/issues/458' } }, async ({ startClient, mcpMode }, testInfo) => {
    const config: Config = {
      browser: {
        browserName: 'firefox',
      },
    };
    const configPath = testInfo.outputPath('config.json');
    await fs.promises.writeFile(configPath, JSON.stringify(config, null, 2));

    const { client } = await startClient({ args: ['--config', configPath] });
    expect(await client.callTool({
      name: 'browser_navigate',
      arguments: { url: 'data:text/html,<script>document.title = navigator.userAgent</script>' },
    })).toHaveResponse({
      pageState: expect.stringContaining(`Firefox`),
    });
  });
});

test.describe('sandbox configuration', () => {
  test('should enable sandbox by default (no --no-sandbox flag)', async () => {
    const { configFromCLIOptions } = await import('../lib/config.js');
    const config = configFromCLIOptions({ sandbox: undefined });
    // When --no-sandbox is not passed, chromiumSandbox should not be set to false
    // This allows the default (true) to be used
    expect(config.browser?.launchOptions?.chromiumSandbox).toBeUndefined();
  });

  test('should disable sandbox when --no-sandbox flag is passed', async () => {
    const { configFromCLIOptions } = await import('../lib/config.js');
    const config = configFromCLIOptions({ sandbox: false });
    // When --no-sandbox is passed, chromiumSandbox should be explicitly set to false
    expect(config.browser?.launchOptions?.chromiumSandbox).toBe(false);
  });
});
