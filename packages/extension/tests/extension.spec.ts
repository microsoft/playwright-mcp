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
  startExtensionClient: (env?: Record<string, string>) => Promise<{ browserContext: BrowserContext, client: Client }>,
  cli: (...args: string[]) => Promise<CliResult>;
};

const extensionPublicKey = 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAwRsUUO4mmbCi4JpmrIoIw31iVW9+xUJRZ6nSzya17PQkaUPDxe1IpgM+vpd/xB6mJWlJSyE1Lj95c0sbomGfVY1M0zUeKbaRVcAb+/a6m59gNR+ubFlmTX0nK9/8fE2FpRB9D+4N5jyeIPQuASW/0oswI2/ijK7hH5NTRX8gWc/ROMSgUj7rKhTAgBrICt/NsStgDPsxRTPPJnhJ/ViJtM1P5KsSYswE987DPoFnpmkFpq8g1ae0eYbQfXy55ieaacC4QWyJPj3daU2kMfBQw7MXnnk0H/WDxouMOIHnd8MlQxpEMqAihj7KpuONH+MUhuj9HEQo4df6bSaIuQ0b4QIDAQAB';
const extensionId = 'mmlmfjhmonkocbjadbfplnigmagldckm';

const test = base.extend<TestFixtures>({
  pathToExtension: async ({}, use, testInfo) => {
    const extensionDir = testInfo.outputPath('extension');
    const srcDir = path.resolve(__dirname, '../dist');
    await fs.cp(srcDir, extensionDir, { recursive: true });
    const manifestPath = path.join(extensionDir, 'manifest.json');
    const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
    // We don't hardcode the key in manifest, but for the tests we set the key field
    // to ensure that locally installed extension has the same id as the one published
    // in the store.
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

  startExtensionClient: async ({ browserWithExtension, startClient }, use) => {
    await use(async (env?: Record<string, string>) => {
      const browserContext = await browserWithExtension.launch();
      const client = await startWithExtensionFlag(browserWithExtension, startClient, env);
      return { browserContext, client };
    });
  },

  cli: async ({ mcpBrowser }, use, testInfo) => {
    await use(async (...args: string[]) => {
      return await runCli(args, { mcpBrowser, testInfo });
    });

    // Cleanup sessions
    await runCli(['close-all'], { mcpBrowser, testInfo }).catch(() => {});

    const daemonDir = path.join(testInfo.outputDir, 'daemon');
    await fs.rm(daemonDir, { recursive: true, force: true }).catch(() => {});
  },
});

function cliEnv() {
  return {
    PLAYWRIGHT_SERVER_REGISTRY: test.info().outputPath('registry'),
    PLAYWRIGHT_DAEMON_SESSION_DIR: test.info().outputPath('daemon'),
    PLAYWRIGHT_SOCKETS_DIR: path.join(test.info().project.outputDir, 'ds', String(test.info().parallelIndex)),
  };
}

async function runCli(
  args: string[],
  options: { mcpBrowser?: string, testInfo: any },
): Promise<CliResult> {
  const stepTitle = `cli ${args.join(' ')}`;

  return await test.step(stepTitle, async () => {
    const testInfo = options.testInfo;

    // Path to the terminal CLI
    const cliPath = path.join(__dirname, '../../../node_modules/playwright-core/lib/tools/cli-client/cli.js');

    return new Promise<CliResult>((resolve, reject) => {
      let stdout = '';
      let stderr = '';

      const childProcess = spawn(process.execPath, [cliPath, ...args], {
        cwd: testInfo.outputPath(),
        env: {
          ...process.env,
          ...cliEnv(),
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

async function startWithExtensionFlag(browserWithExtension: BrowserWithExtension, startClient: StartClient, env?: Record<string, string>): Promise<Client> {
  const { client } = await startClient({
    args: [`--extension`],
    env,
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

test(`navigate with extension`, async ({ startExtensionClient, server }) => {
  const { browserContext, client } = await startExtensionClient();

  const confirmationPagePromise = browserContext.waitForEvent('page', page => {
    return page.url().startsWith(`chrome-extension://${extensionId}/connect.html`);
  });

  const navigateResponse = client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  });

  const selectorPage = await confirmationPagePromise;
  await selectorPage.locator('.tab-item', { hasText: 'Playwright MCP extension' }).getByRole('button', { name: 'Connect' }).click();

  expect(await navigateResponse).toHaveResponse({
    snapshot: expect.stringContaining(`- generic [active] [ref=e1]: Hello, world!`),
  });
});

test(`browser_tabs new creates a new tab`, async ({ startExtensionClient, server }) => {
  server.setContent('/second.html', '<title>Second</title><body>Second page<body>', 'text/html');
  const { browserContext, client } = await startExtensionClient();

  const confirmationPagePromise = browserContext.waitForEvent('page', page => {
    return page.url().startsWith(`chrome-extension://${extensionId}/connect.html`);
  });

  const navigateResponse = client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  });

  const selectorPage = await confirmationPagePromise;
  await selectorPage.locator('.tab-item', { hasText: 'Playwright MCP extension' }).getByRole('button', { name: 'Connect' }).click();

  expect(await navigateResponse).toHaveResponse({
    snapshot: expect.stringContaining(`- generic [active] [ref=e1]: Hello, world!`),
  });

  // Now create a new tab via browser_tabs tool.
  const newTabResponse = await client.callTool({
    name: 'browser_tabs',
    arguments: { action: 'new', url: server.PREFIX + 'second.html' },
  });

  expect(newTabResponse).toHaveResponse({
    snapshot: expect.stringContaining(`- generic [active] [ref=e1]: Second page`),
  });

  // Verify we have two tabs by listing.
  const listResponse = await client.callTool({
    name: 'browser_tabs',
    arguments: { action: 'list' },
  });

  expect(listResponse).toHaveResponse({
    result: expect.stringMatching(/- 0: \[Title\]\(.*\/hello-world\)\n- 1: \(current\) \[Second\]\(.*\/second\.html\)/),
  });
});

test(`cmd+click opens new tab visible in tab list`, async ({ startExtensionClient, server }) => {
  server.setContent('/link-page', '<title>LinkPage</title><body><a href="/target-page">click me</a></body>', 'text/html');
  server.setContent('/target-page', '<title>TargetPage</title><body>Target content</body>', 'text/html');
  const { browserContext, client } = await startExtensionClient();

  const confirmationPagePromise = browserContext.waitForEvent('page', page => {
    return page.url().startsWith(`chrome-extension://${extensionId}/connect.html`);
  });

  const navigateResponse = client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX + 'link-page' },
  });

  const selectorPage = await confirmationPagePromise;
  await selectorPage.locator('.tab-item', { hasText: 'Playwright MCP extension' }).getByRole('button', { name: 'Connect' }).click();

  expect(await navigateResponse).toHaveResponse({
    snapshot: expect.stringContaining(`click me`),
  });

  // Cmd+click (Meta+click) to open link in a new tab.
  await client.callTool({
    name: 'browser_click',
    arguments: { element: 'click me', ref: 'e2', modifiers: ['Meta'] },
  });

  // Wait for the new tab to appear in the list.
  await expect.poll(async () => {
    const listResponse = await client.callTool({
      name: 'browser_tabs',
      arguments: { action: 'list' },
    });
    return (listResponse as any).content?.[0]?.text ?? '';
  }).toContain('TargetPage');

  const listResponse = await client.callTool({
    name: 'browser_tabs',
    arguments: { action: 'list' },
  });

  expect(listResponse).toHaveResponse({
    result: expect.stringMatching(/- 0:.*\[LinkPage\].*\n- 1:.*\[TargetPage\]/),
  });
});

test(`window.open from tracked tab auto-attaches new tab`, async ({ startExtensionClient, server }) => {
  server.setContent('/opener-page', `<title>Opener</title><body><button onclick="window.open('${server.PREFIX}opened-page', '_blank', 'noopener')">open</button></body>`, 'text/html');
  server.setContent('/opened-page', '<title>Opened</title><body>Opened content</body>', 'text/html');
  const { browserContext, client } = await startExtensionClient();

  const confirmationPagePromise = browserContext.waitForEvent('page', page => {
    return page.url().startsWith(`chrome-extension://${extensionId}/connect.html`);
  });

  const navigateResponse = client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX + 'opener-page' },
  });

  const selectorPage = await confirmationPagePromise;
  await selectorPage.locator('.tab-item', { hasText: 'Playwright MCP extension' }).getByRole('button', { name: 'Connect' }).click();

  expect(await navigateResponse).toHaveResponse({
    snapshot: expect.stringContaining('open'),
  });

  // Click the button that calls window.open.
  await client.callTool({
    name: 'browser_click',
    arguments: { element: 'open', ref: 'e2' },
  });

  // Wait for the new tab to appear in the list.
  await expect.poll(async () => {
    const listResponse = await client.callTool({
      name: 'browser_tabs',
      arguments: { action: 'list' },
    });
    return (listResponse as any).content?.[0]?.text ?? '';
  }).toContain('Opened');

  const listResponse = await client.callTool({
    name: 'browser_tabs',
    arguments: { action: 'list' },
  });

  expect(listResponse).toHaveResponse({
    result: expect.stringMatching(/- 0:.*\[Opener\].*\n- 1:.*\[Opened\]/),
  });
});

test(`browser_run_code can evaluate in a web worker`, async ({ startExtensionClient, server }) => {
  server.setContent('/worker.js', `
    self.onmessage = (e) => self.postMessage('echo:' + e.data);
    self.workerName = 'mcp-worker';
  `, 'application/javascript');
  server.setContent('/worker-page', `
    <title>WorkerPage</title>
    <body>
      <script>
        window.__worker = new Worker('/worker.js');
      </script>
    </body>
  `, 'text/html');

  const { browserContext, client } = await startExtensionClient();

  const confirmationPagePromise = browserContext.waitForEvent('page', page => {
    return page.url().startsWith(`chrome-extension://${extensionId}/connect.html`);
  });

  const navigateResponse = client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX + 'worker-page' },
  });

  const selectorPage = await confirmationPagePromise;
  await selectorPage.locator('.tab-item', { hasText: 'Playwright MCP extension' }).getByRole('button', { name: 'Connect' }).click();

  await navigateResponse;

  const runCodeResponse = await client.callTool({
    name: 'browser_run_code',
    arguments: {
      code: `async (page) => {
        const worker = page.workers().length ? page.workers()[0] : await page.waitForEvent('worker');
        return await worker.evaluate(() => self.workerName);
      }`,
    },
  });

  expect(runCodeResponse).toHaveResponse({
    result: expect.stringContaining('mcp-worker'),
  });

  // Open a second page with its own worker via browser_tabs new and verify
  // that worker eval works in that tab too. This exercises child CDP sessions
  // (the worker session) on a non-first tab — the relay must route them to
  // the correct tab rather than always falling back to the first one.
  server.setContent('/worker2.js', `
    self.workerName = 'mcp-worker-2';
  `, 'application/javascript');
  server.setContent('/worker-page-2', `
    <title>WorkerPage2</title>
    <body>
      <script>
        window.__worker = new Worker('/worker2.js');
      </script>
    </body>
  `, 'text/html');

  await client.callTool({
    name: 'browser_tabs',
    arguments: { action: 'new', url: server.PREFIX + 'worker-page-2' },
  });

  const runCodeResponse2 = await client.callTool({
    name: 'browser_run_code',
    arguments: {
      code: `async (page) => {
        const worker = page.workers().length ? page.workers()[0] : await page.waitForEvent('worker');
        return await worker.evaluate(() => self.workerName);
      }`,
    },
  });

  expect(runCodeResponse2).toHaveResponse({
    result: expect.stringContaining('mcp-worker-2'),
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

test(`extension not installed timeout`, async ({ startExtensionClient, server }) => {
  const { browserContext, client } = await startExtensionClient({ PWMCP_TEST_CONNECTION_TIMEOUT: '100' });

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

testWithOldExtensionVersion(`works with old extension version`, async ({ startExtensionClient, server }) => {
  // Prelaunch the browser, so that it is properly closed after the test.
  const { browserContext, client } = await startExtensionClient({ PWMCP_TEST_CONNECTION_TIMEOUT: '500' });

  const confirmationPagePromise = browserContext.waitForEvent('page', page => {
    return page.url().startsWith(`chrome-extension://${extensionId}/connect.html`);
  });

  const navigateResponse = client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  });

  const selectorPage = await confirmationPagePromise;
  await selectorPage.locator('.tab-item', { hasText: 'Playwright MCP extension' }).getByRole('button', { name: 'Connect' }).click();

  expect(await navigateResponse).toHaveResponse({
    snapshot: expect.stringContaining(`- generic [active] [ref=e1]: Hello, world!`),
  });
});

test(`extension needs update`, async ({ startExtensionClient, server }) => {
  // Prelaunch the browser, so that it is properly closed after the test.
  const { browserContext, client } = await startExtensionClient({ PWMCP_TEST_CONNECTION_TIMEOUT: '500', PLAYWRIGHT_EXTENSION_PROTOCOL: '1000' });

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

test(`custom executablePath`, async ({ startClient, server }) => {
  const executablePath = test.info().outputPath('echo.sh');
  await fs.writeFile(executablePath, '#!/bin/bash\necho "Custom exec args: $@" > "$(dirname "$0")/output.txt"', { mode: 0o755 });

  const { client } = await startClient({
    args: [`--extension`],
    env: { PWMCP_TEST_CONNECTION_TIMEOUT: '1000' },
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
    config: {
      browser: {
        userDataDir: browserWithExtension.userDataDir,
      }
    },
    env: {
      PLAYWRIGHT_MCP_EXTENSION_TOKEN: value,
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

test.describe('tab grouping', () => {
  test('connect page is added to green Playwright group on relay connect', async ({ startExtensionClient, server }) => {
    const { browserContext, client } = await startExtensionClient();

    const connectPagePromise = browserContext.waitForEvent('page', page =>
      page.url().startsWith(`chrome-extension://${extensionId}/connect.html`)
    );

    const navigatePromise = client.callTool({ name: 'browser_navigate', arguments: { url: server.HELLO_WORLD } });
    const connectPage = await connectPagePromise;

    // Wait for the tab list to appear — this means connectToMCPRelay was processed
    // by the background and _addTabToGroup has been called.
    await expect(connectPage.locator('.tab-item').first()).toBeVisible();

    const group = await connectPage.evaluate(async () => {
      const chrome = (window as any).chrome;
      const tab = await chrome.tabs.getCurrent();
      if (!tab || tab.groupId === -1)
        return null;
      const g = await chrome.tabGroups.get(tab.groupId);
      return { color: g.color, title: g.title };
    });

    expect(group).toEqual({ color: 'green', title: 'Playwright' });

    await connectPage.locator('.tab-item', { hasText: 'Playwright MCP extension' }).getByRole('button', { name: 'Connect' }).click();
    await navigatePromise;
  });

  test('connected tab is added to same Playwright group', async ({ browserWithExtension, startClient, server }) => {
    const browserContext = await browserWithExtension.launch();

    const page = await browserContext.newPage();
    await page.goto(server.HELLO_WORLD);

    const client = await startWithExtensionFlag(browserWithExtension, startClient);

    const connectPagePromise = browserContext.waitForEvent('page', page =>
      page.url().startsWith(`chrome-extension://${extensionId}/connect.html`)
    );

    const navigatePromise = client.callTool({ name: 'browser_navigate', arguments: { url: server.HELLO_WORLD } });
    const connectPage = await connectPagePromise;

    await connectPage.locator('.tab-item', { hasText: 'Title' }).getByRole('button', { name: 'Connect' }).click();
    await navigatePromise;

    const { connectGroupId, connectedGroupId } = await connectPage.evaluate(async () => {
      const chrome = (window as any).chrome;
      const connectTab = await chrome.tabs.getCurrent();
      const [connectedTab] = await chrome.tabs.query({ title: 'Title' });
      return {
        connectGroupId: connectTab?.groupId,
        connectedGroupId: connectedTab?.groupId,
      };
    });

    expect(connectGroupId).not.toBe(-1);
    expect(connectedGroupId).toBe(connectGroupId);
  });

  test('connected tab is removed from group on disconnect', async ({ browserWithExtension, startClient, server }) => {
    const browserContext = await browserWithExtension.launch();

    const page = await browserContext.newPage();
    await page.goto(server.HELLO_WORLD);

    const client = await startWithExtensionFlag(browserWithExtension, startClient);

    const connectPagePromise = browserContext.waitForEvent('page', page =>
      page.url().startsWith(`chrome-extension://${extensionId}/connect.html`)
    );

    const navigatePromise = client.callTool({ name: 'browser_navigate', arguments: { url: server.HELLO_WORLD } });
    const connectPage = await connectPagePromise;

    await connectPage.locator('.tab-item', { hasText: 'Title' }).getByRole('button', { name: 'Connect' }).click();
    await navigatePromise;

    await client.close();

    await expect.poll(async () => {
      return connectPage.evaluate(async () => {
        const chrome = (window as any).chrome;
        const [tab] = await chrome.tabs.query({ title: 'Title' });
        return tab?.groupId ?? -1;
      });
    }).toBe(-1);
  });
});

test.describe('CLI with extension', () => {
  test('attach <url> --extension', async ({ browserWithExtension, cli, server }, testInfo) => {
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
    const cliPromise = cli('attach', '--extension', `--config=cli-config.json`);

    // Wait for the confirmation page to appear
    const confirmationPage = await confirmationPagePromise;

    // Click the Connect button
    await confirmationPage.locator('.tab-item', { hasText: 'Playwright MCP extension' }).getByRole('button', { name: 'Connect' }).click();

    {
      // Wait for the CLI command to complete
      const { output } = await cliPromise;
      // Verify the output
      expect(output).toContain(`### Page`);
      expect(output).toContain(`- Page URL: chrome-extension://${extensionId}/connect.html?`);
      expect(output).toContain(`- Page Title: Playwright MCP extension`);
    }

    {
      const { output } = await cli('goto', server.HELLO_WORLD);
      // Verify the output
      expect(output).toContain(`### Page`);
      expect(output).toContain(`- Page URL: ${server.HELLO_WORLD}`);
      expect(output).toContain(`- Page Title: Title`);
    }
  });
});
