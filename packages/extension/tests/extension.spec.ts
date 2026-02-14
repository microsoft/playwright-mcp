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

import fs from 'fs/promises';
import path from 'path';
import { chromium } from 'playwright';
import { spawn } from 'child_process';
import { test as base, expect } from '../../playwright-mcp/tests/fixtures';

import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { BrowserContext } from 'playwright';
import type { StartClient } from '../../playwright-mcp/tests/fixtures';

type BrowserWithExtension = {
  userDataDir: string;
  launch: (mode?: 'disable-extension') => Promise<BrowserContext>;
};

type CliResult = {
  output: string;
  error: string;
};

type TestFixtures = {
  browserWithExtension: BrowserWithExtension,
  pathToExtension: string,
  useShortConnectionTimeout: (timeoutMs: number) => void
  overrideProtocolVersion: (version: number) => void
  cli: (...args: string[]) => Promise<CliResult>;
};

const extensionPublicKey = 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA9nMS2b0WCohjVHPGb8D9qAdkbIngDqoAjTeSccHJijgcONejge+OJxOQOMLu7b0ovt1c9BiEJa5JcpM+EHFVGL1vluBxK71zmBy1m2f9vZF3HG0LSCp7YRkum9rAIEthDwbkxx6XTvpmAY5rjFa/NON6b9Hlbo+8peUSkoOK7HTwYnnI36asZ9eUTiveIf+DMPLojW2UX33vDWG2UKvMVDewzclb4+uLxAYshY7Mx8we/b44xu+Anb/EBLKjOPk9Yh541xJ5Ozc8EiP/5yxOp9c/lRiYUHaRW+4r0HKZyFt0eZ52ti2iM4Nfk7jRXR7an3JPsUIf5deC/1cVM/+1ZQIDAQAB';
const extensionId = 'jakfalbnbhgkpmoaakfflhflbfpkailf';

const test = base.extend<TestFixtures>({
  pathToExtension: async ({}, use, testInfo) => {
    const extensionDir = testInfo.outputPath('extension');
    const srcDir = path.resolve(__dirname, '../dist');
    await fs.cp(srcDir, extensionDir, { recursive: true });
    const manifestPath = path.join(extensionDir, 'manifest.json');
    const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
    manifest.key = extensionPublicKey;
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
    await use(extensionDir);
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

    // Free up disk space.
    await fs.rm(userDataDir, { recursive: true, force: true }).catch(() => {});
  },

  useShortConnectionTimeout: async ({}, use) => {
    await use((timeoutMs: number) => {
      process.env.PWMCP_TEST_CONNECTION_TIMEOUT = timeoutMs.toString();
    });
    process.env.PWMCP_TEST_CONNECTION_TIMEOUT = undefined;
  },

  overrideProtocolVersion: async ({}, use) => {
    await use((version: number) => {
      process.env.PWMCP_TEST_PROTOCOL_VERSION = version.toString();
    });
    process.env.PWMCP_TEST_PROTOCOL_VERSION = undefined;
  },

  cli: async ({ mcpBrowser }, use, testInfo) => {
    await use(async (...args: string[]) => {
      return await runCli(args, { mcpBrowser, testInfo });
    });

    // Cleanup sessions
    await runCli(['session-stop-all'], { mcpBrowser, testInfo }).catch(() => {});

    const daemonDir = path.join(testInfo.outputDir, 'daemon');
    await fs.rm(daemonDir, { recursive: true, force: true }).catch(() => {});
  },
});

async function runCli(
  args: string[],
  options: { mcpBrowser?: string, testInfo: any },
): Promise<CliResult> {
  const stepTitle = `cli ${args.join(' ')}`;

  return await test.step(stepTitle, async () => {
    const testInfo = options.testInfo;

    // Path to the terminal CLI
    const cliPath = path.join(__dirname, '../../../node_modules/playwright/lib/mcp/terminal/cli.js');

    return new Promise<CliResult>((resolve, reject) => {
      let stdout = '';
      let stderr = '';

      const childProcess = spawn(process.execPath, [cliPath, ...args], {
        cwd: testInfo.outputPath(),
        env: {
          ...process.env,
          PLAYWRIGHT_DAEMON_INSTALL_DIR: testInfo.outputPath(),
          PLAYWRIGHT_DAEMON_SESSION_DIR: testInfo.outputPath('daemon'),
          PLAYWRIGHT_DAEMON_SOCKETS_DIR: path.join(testInfo.project.outputDir, 'daemon-sockets'),
          PLAYWRIGHT_MCP_BROWSER: options.mcpBrowser,
          PLAYWRIGHT_MCP_HEADLESS: 'false',
        },
        detached: true,
      });

      childProcess.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      childProcess.stderr?.on('data', (data) => {
        if (process.env.PWMCP_DEBUG)
          process.stderr.write(data);
        stderr += data.toString();
      });

      childProcess.on('close', async (code) => {
        await testInfo.attach(stepTitle, { body: stdout, contentType: 'text/plain' });
        resolve({
          output: stdout.trim(),
          error: stderr.trim(),
        });
      });

      childProcess.on('error', reject);
    });
  });
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

const testWithOldExtensionVersion = test.extend({
  pathToExtension: async ({ pathToExtension }, use, testInfo) => {
    const manifestPath = path.join(pathToExtension, 'manifest.json');
    const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
    manifest.key = extensionPublicKey;
    manifest.version = '0.0.1';
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
    await use(pathToExtension);
  },
});

test(`navigate with extension`, async ({ browserWithExtension, startClient, server }) => {
  const browserContext = await browserWithExtension.launch();

  const client = await startWithExtensionFlag(browserWithExtension, startClient);

  const confirmationPagePromise = browserContext.waitForEvent('page', page => {
    return page.url().startsWith(`chrome-extension://${extensionId}/connect.html`);
  });

  const navigateResponse = client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  });

  const selectorPage = await confirmationPagePromise;
  // For browser_navigate command, the UI shows Allow/Reject buttons instead of tab selector
  await selectorPage.getByRole('button', { name: 'Allow' }).click();

  expect(await navigateResponse).toHaveResponse({
    snapshot: expect.stringContaining(`- generic [active] [ref=e1]: Hello, world!`),
  });
});

test(`snapshot of an existing page`, async ({ browserWithExtension, startClient, server }) => {
  const browserContext = await browserWithExtension.launch();

  const page = await browserContext.newPage();
  await page.goto(server.HELLO_WORLD);

  // Another empty page.
  await browserContext.newPage();
  expect(browserContext.pages()).toHaveLength(3);

  const client = await startWithExtensionFlag(browserWithExtension, startClient);
  expect(browserContext.pages()).toHaveLength(3);

  const confirmationPagePromise = browserContext.waitForEvent('page', page => {
    return page.url().startsWith(`chrome-extension://${extensionId}/connect.html`);
  });

  const navigateResponse = client.callTool({
    name: 'browser_snapshot',
    arguments: { },
  });

  const selectorPage = await confirmationPagePromise;
  expect(browserContext.pages()).toHaveLength(4);

  await selectorPage.locator('.tab-item', { hasText: 'Title' }).getByRole('button', { name: 'Connect' }).click();

  expect(await navigateResponse).toHaveResponse({
    snapshot: expect.stringContaining(`- generic [active] [ref=e1]: Hello, world!`),
  });

  expect(browserContext.pages()).toHaveLength(4);
});

test(`extension not installed timeout`, async ({ browserWithExtension, startClient, server, useShortConnectionTimeout }) => {
  useShortConnectionTimeout(100);

  const browserContext = await browserWithExtension.launch();

  const client = await startWithExtensionFlag(browserWithExtension, startClient);

  const confirmationPagePromise = browserContext.waitForEvent('page', page => {
    return page.url().startsWith(`chrome-extension://${extensionId}/connect.html`);
  });

  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  })).toHaveResponse({
    error: expect.stringContaining('Extension connection timeout. Make sure the "Playwright MCP Bridge" extension is installed.'),
    isError: true,
  });

  await confirmationPagePromise;
});

testWithOldExtensionVersion(`works with old extension version`, async ({ browserWithExtension, startClient, server, useShortConnectionTimeout }) => {
  useShortConnectionTimeout(500);

  // Prelaunch the browser, so that it is properly closed after the test.
  const browserContext = await browserWithExtension.launch();

  const client = await startWithExtensionFlag(browserWithExtension, startClient);

  const confirmationPagePromise = browserContext.waitForEvent('page', page => {
    return page.url().startsWith(`chrome-extension://${extensionId}/connect.html`);
  });

  const navigateResponse = client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  });

  const selectorPage = await confirmationPagePromise;
  // For browser_navigate command, the UI shows Allow/Reject buttons instead of tab selector
  await selectorPage.getByRole('button', { name: 'Allow' }).click();

  expect(await navigateResponse).toHaveResponse({
    snapshot: expect.stringContaining(`- generic [active] [ref=e1]: Hello, world!`),
  });
});

test(`extension needs update`, async ({ browserWithExtension, startClient, server, useShortConnectionTimeout, overrideProtocolVersion }) => {
  useShortConnectionTimeout(500);
  overrideProtocolVersion(1000);

  // Prelaunch the browser, so that it is properly closed after the test.
  const browserContext = await browserWithExtension.launch();

  const client = await startWithExtensionFlag(browserWithExtension, startClient);

  const confirmationPagePromise = browserContext.waitForEvent('page', page => {
    return page.url().startsWith(`chrome-extension://${extensionId}/connect.html`);
  });

  const navigateResponse = client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  });

  const confirmationPage = await confirmationPagePromise;
  await expect(confirmationPage.locator('.status-banner')).toContainText(`Playwright MCP version trying to connect requires newer extension version`);

  expect(await navigateResponse).toHaveResponse({
    error: expect.stringContaining('Extension connection timeout.'),
    isError: true,
  });
});

test(`custom executablePath`, async ({ startClient, server, useShortConnectionTimeout }) => {
  useShortConnectionTimeout(1000);

  const executablePath = test.info().outputPath('echo.sh');
  await fs.writeFile(executablePath, '#!/bin/bash\necho "Custom exec args: $@" > "$(dirname "$0")/output.txt"', { mode: 0o755 });

  const { client } = await startClient({
    args: [`--extension`],
    config: {
      browser: {
        launchOptions: {
          executablePath,
        },
      }
    },
  });

  const navigateResponse = await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  });
  expect(await navigateResponse).toHaveResponse({
    error: expect.stringContaining('Extension connection timeout.'),
    isError: true,
  });
  expect(await fs.readFile(test.info().outputPath('output.txt'), 'utf8')).toMatch(new RegExp(`Custom exec args.*chrome-extension://${extensionId}/connect\\.html\\?`));
});

test(`bypass connection dialog with token`, async ({ browserWithExtension, startClient, server }) => {
  const browserContext = await browserWithExtension.launch();

  const page = await browserContext.newPage();
  await page.goto(`chrome-extension://${extensionId}/status.html`);
  const token = await page.locator('.auth-token-code').textContent();
  const [name, value] = token?.split('=') || [];

  const { client } = await startClient({
    args: [`--extension`],
    extensionToken: value,
    config: {
      browser: {
        userDataDir: browserWithExtension.userDataDir,
      }
    },
  });

  const navigateResponse = await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  });

  expect(await navigateResponse).toHaveResponse({
    snapshot: expect.stringContaining(`- generic [active] [ref=e1]: Hello, world!`),
  });
});

test.describe('CLI with extension', () => {
  test('open <url> --extension', async ({ browserWithExtension, cli, server }, testInfo) => {
    const browserContext = await browserWithExtension.launch();

    // Write config file with userDataDir 
    const configPath = testInfo.outputPath('cli-config.json');
    await fs.writeFile(configPath, JSON.stringify({
      browser: {
        userDataDir: browserWithExtension.userDataDir,
      }
    }, null, 2));

    const confirmationPagePromise = browserContext.waitForEvent('page', page => {
      return page.url().startsWith(`chrome-extension://${extensionId}/connect.html`);
    });

    // Start the CLI command in the background
    const cliPromise = cli('open', server.HELLO_WORLD, '--extension', `--config=cli-config.json`);

    // Wait for the confirmation page to appear
    const confirmationPage = await confirmationPagePromise;

    // Click the Allow button
    await confirmationPage.getByRole('button', { name: 'Allow' }).click();

    // Wait for the CLI command to complete
    const { output } = await cliPromise;

    // Verify the output
    expect(output).toContain(`### Page`);
    expect(output).toContain(`- Page URL: ${server.HELLO_WORLD}`);
    expect(output).toContain(`- Page Title: Title`);
  });
});
