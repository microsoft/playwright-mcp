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
import url from 'url';
import path from 'path';
import readline from 'node:readline';
import { chromium, Page } from 'playwright';

import { test as baseTest, expect as baseExpect } from '@playwright/test';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { ChildProcessWithoutNullStreams, spawn } from 'child_process';
import { TestServer } from './testserver/index.ts';

import type { Config } from '../config';

export type TestOptions = {
  mcpBrowser: string | undefined;
  mcpExtension: boolean | undefined;
};

type TestFixtures = {
  client: Client;
  clientOutputLines: string[];
  visionClient: Client;
  startClient: (options?: { args?: string[], config?: Config }) => Promise<Client>;
  wsEndpoint: string;
  cdpEndpoint: (port?: number) => Promise<string>;
  server: TestServer;
  httpsServer: TestServer;
  mcpHeadless: boolean;
  mcpExtensionPage: Page | undefined;
};

type WorkerFixtures = {
  _workerServers: { server: TestServer, httpsServer: TestServer };
};

export const test = baseTest.extend<TestFixtures & TestOptions, WorkerFixtures>({

  client: async ({ startClient }, use) => {
    await use(await startClient());
  },

  clientOutputLines: async ({}, use) => use([]),

  visionClient: async ({ startClient }, use) => {
    await use(await startClient({ args: ['--vision'] }));
  },

  startClient: async ({ mcpHeadless, mcpBrowser, mcpExtension, mcpExtensionPage, clientOutputLines }, use, testInfo) => {
    const userDataDir = testInfo.outputPath('user-data-dir');
    let client: Client | undefined;

    await use(async options => {
      if (client)
        throw new Error('Client already started');
      const args = ['--user-data-dir', userDataDir];
      if (mcpHeadless)
        args.push('--headless');
      if (mcpBrowser)
        args.push(`--browser=${mcpBrowser}`);
      if (mcpExtension)
        args.push('--extension');
      if (options?.args)
        args.push(...options.args);
      if (options?.config) {
        const configFile = testInfo.outputPath('config.json');
        await fs.promises.writeFile(configFile, JSON.stringify(options.config, null, 2));
        args.push(`--config=${configFile}`);
      }
      // NOTE: Can be removed when we drop Node.js 18 support and changed to import.meta.filename.
      const __filename = url.fileURLToPath(import.meta.url);
      const transport = new StdioClientTransport({
        command: 'node',
        args: [path.join(path.dirname(__filename), '../cli.js'), ...args],
        env: {
          ...process.env,
          IS_UNDER_TEST: '1',
        },
        stderr: 'pipe',
      });
      client = new Client({ name: 'test', version: '1.0.0' });
      await client.connect(transport);
      readline.createInterface(transport.stderr as any as NodeJS.ReadableStream).on('line', line => {
        if (line.toString().startsWith('%%'))
          clientOutputLines.push(line.substring(2));
        else
          // eslint-disable-next-line no-console
          console.error(line);
      });
      if (mcpExtension && mcpExtensionPage) {
        const browserConnectCall = client.callTool({
          name: 'browser_connect',
          arguments: {},
        });
        await expect.poll(() => clientOutputLines.filter(line => line.startsWith('open call to: ')), { timeout: test.info().timeout }).toHaveLength(1);
        const openCallURL = clientOutputLines.filter(line => line.startsWith('open call to: '))[0].split('open call to: ')[1];
        await mcpExtensionPage.goto(openCallURL);
        await mcpExtensionPage.getByRole('button', { name: 'Allow Connection' }).click();
        await expect(mcpExtensionPage.getByRole('heading', { name: 'Connection Established' })).toBeVisible();
        await browserConnectCall;
      }
      await client.ping();
      return client;
    });

    await client?.close();
  },

  wsEndpoint: async ({ }, use) => {
    const browserServer = await chromium.launchServer();
    await use(browserServer.wsEndpoint());
    await browserServer.close();
  },

  cdpEndpoint: async ({ }, use, testInfo) => {
    let browserProcess: ChildProcessWithoutNullStreams | undefined;

    await use(async port => {
      if (!port)
        port = 3200 + test.info().parallelIndex;
      if (browserProcess)
        return `http://localhost:${port}`;
      browserProcess = spawn(chromium.executablePath(), [
        `--user-data-dir=${testInfo.outputPath('user-data-dir')}`,
        `--remote-debugging-port=${port}`,
        `--no-first-run`,
        `--no-sandbox`,
        `--headless`,
        '--use-mock-keychain',
        `data:text/html,hello world`,
      ], {
        stdio: 'pipe',
      });
      await new Promise<void>(resolve => {
        browserProcess!.stderr.on('data', data => {
          if (data.toString().includes('DevTools listening on '))
            resolve();
        });
      });
      return `http://localhost:${port}`;
    });
    browserProcess?.kill();
  },

  mcpHeadless: async ({ headless }, use) => {
    await use(headless);
  },

  mcpBrowser: ['chrome', { option: true }],

  mcpExtension: [false, { option: true }],

  mcpExtensionPage: async ({ mcpExtension, mcpHeadless }, use) => {
    if (!mcpExtension)
      return await use(undefined);
    const webSocketPort = 8900 + test.info().parallelIndex * 4;
    const pathToExtension = path.join(url.fileURLToPath(import.meta.url), '../../extension');
    const context = await chromium.launchPersistentContext('', {
      headless: mcpHeadless,
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
        '--enable-features=AllowContentInitiatedDataUrlNavigations',
        `--remote-debugging-port=1234`,
      ],
      channel: 'chromium',
      ...{ assistantMode: true, webSocketPort },
    });
    const page = context.pages()[0];
    // Do not auto dismiss dialogs.
    page.on('dialog', () => {});
    await expect.poll(() => context?.serviceWorkers()).toHaveLength(1);
    await use(page);
    await context?.close();
  },

  _workerServers: [async ({}, use, workerInfo) => {
    const port = 8907 + workerInfo.workerIndex * 4;
    const server = await TestServer.create(port);

    const httpsPort = port + 1;
    const httpsServer = await TestServer.createHTTPS(httpsPort);

    await use({ server, httpsServer });

    await Promise.all([
      server.stop(),
      httpsServer.stop(),
    ]);
  }, { scope: 'worker' }],

  server: async ({ _workerServers }, use) => {
    _workerServers.server.reset();
    await use(_workerServers.server);
  },

  httpsServer: async ({ _workerServers }, use) => {
    _workerServers.httpsServer.reset();
    await use(_workerServers.httpsServer);
  },
});

type Response = Awaited<ReturnType<Client['callTool']>>;

export const expect = baseExpect.extend({
  toHaveTextContent(response: Response, content: string | RegExp) {
    const isNot = this.isNot;
    try {
      const text = (response.content as any)[0].text;
      if (typeof content === 'string') {
        if (isNot)
          baseExpect(text.trim()).not.toBe(content.trim());
        else
          baseExpect(text.trim()).toBe(content.trim());
      } else {
        if (isNot)
          baseExpect(text).not.toMatch(content);
        else
          baseExpect(text).toMatch(content);
      }
    } catch (e) {
      return {
        pass: isNot,
        message: () => e.message,
      };
    }
    return {
      pass: !isNot,
      message: () => ``,
    };
  },

  toContainTextContent(response: Response, content: string | string[]) {
    const isNot = this.isNot;
    try {
      content = Array.isArray(content) ? content : [content];
      const texts = (response.content as any).map(c => c.text);
      for (let i = 0; i < texts.length; i++) {
        if (isNot)
          expect(texts[i]).not.toContain(content[i]);
        else
          expect(texts[i]).toContain(content[i]);
      }
    } catch (e) {
      return {
        pass: isNot,
        message: () => e.message,
      };
    }
    return {
      pass: !isNot,
      message: () => ``,
    };
  },
});
