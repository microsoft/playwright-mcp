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

import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import { test as base, expect } from '../../tests/fixtures.js';

import type { BrowserContext } from 'playwright';

type BrowserWithExtension = {
  userDataDir: string;
  launch: () => Promise<BrowserContext>;
};

const test = base.extend<{ browserWithExtension: BrowserWithExtension }>({
  browserWithExtension: async ({ mcpBrowser }, use, testInfo) => {
    // The flags no longer work in Chrome since
    // https://chromium.googlesource.com/chromium/src/+/290ed8046692651ce76088914750cb659b65fb17%5E%21/chrome/browser/extensions/extension_service.cc?pli=1#
    test.skip('chromium' !== mcpBrowser, '--load-extension is not supported for official builds of Chromium');

    const pathToExtension = fileURLToPath(new URL('../dist', import.meta.url));

    let browserContext: BrowserContext | undefined;
    const userDataDir = testInfo.outputPath('extension-user-data-dir');
    await use({
      userDataDir,
      launch: async () => {
        browserContext = await chromium.launchPersistentContext(userDataDir, {
          channel: mcpBrowser,
          // Opening the browser singleton only works in headed.
          headless: false,
          // Automation disables singleton browser process behavior, which is necessary for the extension.
          ignoreDefaultArgs: ['--enable-automation'],
          args: [
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
});

test('navigate with extension', async ({ browserWithExtension, startClient, server }) => {
  const browserContext = await browserWithExtension.launch();

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
      method: 'extension'
    }
  })).toHaveResponse({
    result: 'Successfully changed connection method.',
  });

  const confirmationPagePromise = browserContext.waitForEvent('page', page => {
    return page.url().startsWith('chrome-extension://jakfalbnbhgkpmoaakfflhflbfpkailf/connect.html');
  });

  const navigateResponse = client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  });

  const selectorPage = await confirmationPagePromise;
  await selectorPage.getByRole('button', { name: 'Continue' }).click();

  expect(await navigateResponse).toHaveResponse({
    pageState: expect.stringContaining(`- generic [active] [ref=e1]: Hello, world!`),
  });
});
