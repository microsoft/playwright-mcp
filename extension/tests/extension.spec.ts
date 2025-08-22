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

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import packageJSON from '../../package.json' assert { type: 'json' };
import { test as base, expect } from '../../tests/fixtures.js';

import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { BrowserContext } from 'playwright';
import type { StartClient } from '../../tests/fixtures.js';

type BrowserWithExtension = {
  userDataDir: string;
  launch: (mode?: 'disable-extension') => Promise<BrowserContext>;
};

type TestFixtures = {
  browserWithExtension: BrowserWithExtension,
  pathToExtension: string,
  useShortConnectionTimeout: (timeoutMs: number) => void
};

const test = base.extend<TestFixtures>({
  pathToExtension: async ({}, use) => {
    await use(fileURLToPath(new URL('../dist', import.meta.url)));
  },

  browserWithExtension: async ({ mcpBrowser, pathToExtension }, use, testInfo) => {
    // The flags no longer work in Chrome since
    // https://chromium.googlesource.com/chromium/src/+/290ed8046692651ce76088914750cb659b65fb17%5E%21/chrome/browser/extensions/extension_service.cc?pli=1#
    test.skip('chromium' !== mcpBrowser, '--load-extension is not supported for official builds of Chromium');

    let browserContext: BrowserContext | undefined;
    const userDataDir = testInfo.outputPath('extension-user-data-dir');
    await use({
      userDataDir,
      launch: async (mode?: 'disable-extension') => {
        browserContext = await chromium.launchPersistentContext(userDataDir, {
          channel: mcpBrowser,
          // Opening the browser singleton only works in headed.
          headless: false,
          // Automation disables singleton browser process behavior, which is necessary for the extension.
          ignoreDefaultArgs: ['--enable-automation'],
          args: mode === 'disable-extension' ? [] : [
            `--disable-extensions-except=${pathToExtension}`,
            `--load-extension=${pathToExtension}`,
          ],
        });

        // for manifest v3:
        let [serviceWorker] = browserContext.serviceWorkers();
        if (!serviceWorker)
          serviceWorker = await browserContext.waitForEvent('serviceworker');

        return browserContext;
      }
    });
    await browserContext?.close();
  },

  useShortConnectionTimeout: async ({}, use) => {
    await use((timeoutMs: number) => {
      process.env.PWMCP_TEST_CONNECTION_TIMEOUT = timeoutMs.toString();
    });
    process.env.PWMCP_TEST_CONNECTION_TIMEOUT = undefined;
  },

});

async function startAndCallConnectTool(browserWithExtension: BrowserWithExtension, startClient: StartClient): Promise<Client> {
  const { client } = await startClient({
    args: [`--connect-tool`],
    config: {
      browser: {
        userDataDir: browserWithExtension.userDataDir,
      }
    },
  });

  expect(await client.callTool({
    name: 'browser_connect',
    arguments: {
      name: 'extension'
    }
  })).toHaveResponse({
    result: 'Successfully changed connection method.',
  });

  return client;
}

async function startWithExtensionFlag(browserWithExtension: BrowserWithExtension, startClient: StartClient): Promise<Client> {
  const { client } = await startClient({
    args: [`--extension`],
    config: {
      browser: {
        userDataDir: browserWithExtension.userDataDir,
      }
    },
  });
  return client;
}

const testWithOldVersion = test.extend({
  pathToExtension: async ({}, use, testInfo) => {
    const extensionDir = testInfo.outputPath('extension');
    const oldPath = fileURLToPath(new URL('../dist', import.meta.url));

    await fs.promises.cp(oldPath, extensionDir, { recursive: true });
    const manifestPath = path.join(extensionDir, 'manifest.json');
    const manifest = JSON.parse(await fs.promises.readFile(manifestPath, 'utf8'));
    manifest.version = '0.0.1';
    await fs.promises.writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

    await use(extensionDir);
  },
});

for (const [mode, startClientMethod] of [
  ['connect-tool', startAndCallConnectTool],
  ['extension-flag', startWithExtensionFlag],
] as const) {

  test(`navigate with extension (${mode})`, async ({ browserWithExtension, startClient, server }) => {
    const browserContext = await browserWithExtension.launch();

    const client = await startClientMethod(browserWithExtension, startClient);

    const confirmationPagePromise = browserContext.waitForEvent('page', page => {
      return page.url().startsWith('chrome-extension://jakfalbnbhgkpmoaakfflhflbfpkailf/connect.html');
    });

    const navigateResponse = client.callTool({
      name: 'browser_navigate',
      arguments: { url: server.HELLO_WORLD },
    });

    const selectorPage = await confirmationPagePromise;
    await selectorPage.locator('.tab-item', { hasText: 'Playwright MCP Extension' }).getByRole('button', { name: 'Connect' }).click();

    expect(await navigateResponse).toHaveResponse({
      pageState: expect.stringContaining(`- generic [active] [ref=e1]: Hello, world!`),
    });
  });

  test(`snapshot of an existing page (${mode})`, async ({ browserWithExtension, startClient, server }) => {
    const browserContext = await browserWithExtension.launch();

    const page = await browserContext.newPage();
    await page.goto(server.HELLO_WORLD);

    // Another empty page.
    await browserContext.newPage();
    expect(browserContext.pages()).toHaveLength(3);

    const client = await startClientMethod(browserWithExtension, startClient);
    expect(browserContext.pages()).toHaveLength(3);

    const confirmationPagePromise = browserContext.waitForEvent('page', page => {
      return page.url().startsWith('chrome-extension://jakfalbnbhgkpmoaakfflhflbfpkailf/connect.html');
    });

    const navigateResponse = client.callTool({
      name: 'browser_snapshot',
      arguments: { },
    });

    const selectorPage = await confirmationPagePromise;
    expect(browserContext.pages()).toHaveLength(4);

    await selectorPage.locator('.tab-item', { hasText: 'Title' }).getByRole('button', { name: 'Connect' }).click();

    expect(await navigateResponse).toHaveResponse({
      pageState: expect.stringContaining(`- generic [active] [ref=e1]: Hello, world!`),
    });

    expect(browserContext.pages()).toHaveLength(4);
  });

  test(`extension not installed timeout (${mode})`, async ({ browserWithExtension, startClient, server, useShortConnectionTimeout }) => {
    useShortConnectionTimeout(100);

    const browserContext = await browserWithExtension.launch();

    const client = await startClientMethod(browserWithExtension, startClient);

    const confirmationPagePromise = browserContext.waitForEvent('page', page => {
      return page.url().startsWith('chrome-extension://jakfalbnbhgkpmoaakfflhflbfpkailf/connect.html');
    });

    expect(await client.callTool({
      name: 'browser_navigate',
      arguments: { url: server.HELLO_WORLD },
    })).toHaveResponse({
      result: expect.stringContaining('Extension connection timeout. Make sure the "Playwright MCP Bridge" extension is installed.'),
      isError: true,
    });

    await confirmationPagePromise;
  });

  testWithOldVersion(`extension version mismatch (${mode})`, async ({ browserWithExtension, startClient, server, useShortConnectionTimeout }) => {
    useShortConnectionTimeout(500);

    // Prelaunch the browser, so that it is properly closed after the test.
    const browserContext = await browserWithExtension.launch();

    const client = await startClientMethod(browserWithExtension, startClient);

    const confirmationPagePromise = browserContext.waitForEvent('page', page => {
      return page.url().startsWith('chrome-extension://jakfalbnbhgkpmoaakfflhflbfpkailf/connect.html');
    });

    const navigateResponse = client.callTool({
      name: 'browser_navigate',
      arguments: { url: server.HELLO_WORLD },
    });

    const confirmationPage = await confirmationPagePromise;
    await expect(confirmationPage.locator('.status-banner')).toHaveText(`Incompatible Playwright MCP version: ${packageJSON.version} (extension version: 0.0.1). Click here to download the matching extension, then drag and drop it into the Chrome Extensions page. See installation instructions for more details.`);

    expect(await navigateResponse).toHaveResponse({
      result: expect.stringContaining('Extension connection timeout.'),
      isError: true,
    });

    const downloadPromise = confirmationPage.waitForEvent('download');
    await confirmationPage.locator('.status-banner').getByRole('button', { name: 'Click here' }).click();
    const download = await downloadPromise;
    expect(download.url()).toBe(`https://github.com/microsoft/playwright-mcp/releases/download/v0.0.1/playwright-mcp-extension-v0.0.1.zip`);
    await download.cancel();
  });

}
