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
import { chromium, Page } from 'playwright';

import { test as baseTest, expect as baseExpect } from '@playwright/test';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { TestServer } from './testserver/index.ts';

import type { Config } from '../config';
import type { BrowserContext } from 'playwright';
import { fork } from 'child_process';
import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { ManualPromise } from '../src/manualPromise.js';

export type TestOptions = {
  mcpBrowser: string | undefined;
  mcpMode: 'docker' | 'extension' | undefined;
};

type CDPServer = {
  endpoint: string;
  start: () => Promise<BrowserContext>;
};

type TestFixtures = {
  client: Client;
  visionClient: Client;
  startClient: (options?: { clientName?: string, args?: string[], config?: Config }) => Promise<{ client: Client, stderr: () => string }>;
  wsEndpoint: string;
  cdpServer: CDPServer;
  server: TestServer;
  httpsServer: TestServer;
  mcpHeadless: boolean;
  mcpExtensionPage: { page: Page, connect: () => Promise<void> } | undefined;
};

type WorkerFixtures = {
  _workerServers: { server: TestServer, httpsServer: TestServer };
};

const kTransportPort = Symbol('kTransportPort');

export const test = baseTest.extend<TestFixtures & TestOptions, WorkerFixtures>({

  client: async ({ startClient }, use) => {
    const { client } = await startClient();
    await use(client);
  },

  visionClient: async ({ startClient }, use) => {
    const { client } = await startClient({ args: ['--vision'] });
    await use(client);
  },

  startClient: async ({ mcpHeadless, mcpBrowser, mcpMode, mcpExtensionPage }, use, testInfo) => {
    const userDataDir = mcpMode !== 'docker' ? testInfo.outputPath('user-data-dir') : undefined;
    const configDir = path.dirname(test.info().config.configFile!);
    let client: Client | undefined;
    let dispose: (() => void) | undefined;

    await use(async options => {
      if (client)
        throw new Error('Client already started');
      const args: string[] = [];
      if (userDataDir)
        args.push('--user-data-dir', userDataDir);
      if (process.env.CI && process.platform === 'linux')
        args.push('--no-sandbox');
      if (mcpHeadless)
        args.push('--headless');
      if (mcpBrowser)
        args.push(`--browser=${mcpBrowser}`);
      if (mcpMode === 'extension')
        args.push('--extension');
      if (options?.args)
        args.push(...options.args);
      if (options?.config) {
        const configFile = testInfo.outputPath('config.json');
        await fs.promises.writeFile(configFile, JSON.stringify(options.config, null, 2));
        args.push(`--config=${path.relative(configDir, configFile)}`);
      }

      client = new Client({ name: options?.clientName ?? 'test', version: '1.0.0' });
      const { transport, stderr, disposeTransport } = await createTransport(args, mcpMode);
      dispose = disposeTransport;
      await client.connect(transport);
      if (mcpMode === 'extension' && mcpExtensionPage)
        await mcpExtensionPage.connect();
      await client.ping();
      return { client, stderr };
    });

    await client?.close();
    dispose?.();
  },

  wsEndpoint: async ({ }, use) => {
    const browserServer = await chromium.launchServer();
    await use(browserServer.wsEndpoint());
    await browserServer.close();
  },

  cdpServer: async ({ mcpBrowser }, use, testInfo) => {
    test.skip(!['chrome', 'msedge', 'chromium'].includes(mcpBrowser!), 'CDP is not supported for non-Chromium browsers');

    let browserContext: BrowserContext | undefined;
    const port = 3200 + test.info().parallelIndex;
    await use({
      endpoint: `http://localhost:${port}`,
      start: async () => {
        browserContext = await chromium.launchPersistentContext(testInfo.outputPath('cdp-user-data-dir'), {
          channel: mcpBrowser,
          headless: true,
          args: [
            `--remote-debugging-port=${port}`,
          ],
        });
        return browserContext;
      }
    });
    await browserContext?.close();
  },

  mcpHeadless: async ({ headless }, use) => {
    await use(headless);
  },

  mcpBrowser: ['chrome', { option: true }],

  mcpMode: [undefined, { option: true }],

  mcpExtensionPage: async ({ mcpMode, mcpHeadless }, use) => {
    if (mcpMode !== 'extension')
      return await use(undefined);
    const cdpPort = 8900 + test.info().parallelIndex * 4;
    const pathToExtension = path.join(url.fileURLToPath(import.meta.url), '../../extension');
    const context = await chromium.launchPersistentContext('', {
      headless: mcpHeadless,
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
        '--enable-features=AllowContentInitiatedDataUrlNavigations',
      ],
      channel: 'chromium',
      ...{ assistantMode: true, cdpPort },
    });
    const popupPage = await context.newPage();
    const page = context.pages()[0];
    await page.bringToFront();
    // Do not auto dismiss dialogs.
    page.on('dialog', () => { });
    await expect.poll(() => context?.serviceWorkers()).toHaveLength(1);
    await use({
      page,
      connect: async () => {
        await popupPage.goto(new URL('/popup.html', context.serviceWorkers()[0].url()).toString());
        await popupPage.getByRole('textbox', { name: 'Bridge Server URL:' }).clear();
        await popupPage.getByRole('textbox', { name: 'Bridge Server URL:' }).fill(test[kTransportPort]);
        await popupPage.getByRole('button', { name: 'Share This Tab' }).click();
      }
    });
    await context?.close();
  },

  _workerServers: [async ({ }, use, workerInfo) => {
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

async function createTransport(args: string[], mcpMode: TestOptions['mcpMode']): Promise<{
  transport: Transport,
  disposeTransport?: () => void,
  stderr: () => string,
}> {
  let stderrBuffer = '';
  const stderr = () => stderrBuffer;
  // NOTE: Can be removed when we drop Node.js 18 support and changed to import.meta.filename.
  const __filename = url.fileURLToPath(import.meta.url);
  if (mcpMode === 'docker') {
    const dockerArgs = ['run', '--rm', '-i', '--network=host', '-v', `${test.info().project.outputDir}:/app/test-results`];
    const transport = new StdioClientTransport({
      command: 'docker',
      args: [...dockerArgs, 'playwright-mcp-dev:latest', ...args],
    });
    transport.stderr?.on('data', data => {
      stderrBuffer += data.toString();
    });
    return {
      transport,
      stderr,
    };
  }
  if (mcpMode === 'extension') {
    const cp = fork(path.join(__filename, '../../cli.js'), [...args, '--port=0'], {
      stdio: 'pipe'
    });
    const cdpRelayServerReady = new ManualPromise<string>();
    const sseEndpointPromise = new ManualPromise<string>();
    cp.stderr?.on('data', data => {
      if (process.env.MCPDEBUG)
        // eslint-disable-next-line no-console
        console.error(data.toString());
      const match = data.toString().match(/Listening on (http:\/\/.*)/);
      if (match)
        sseEndpointPromise.resolve(match[1].toString());
      const extensionMatch = data.toString().match(/CDP relay server started on (ws:\/\/.*\/extension)/);
      if (extensionMatch)
        cdpRelayServerReady.resolve(extensionMatch[1].toString());
    });
    cp.on('exit', () => sseEndpointPromise.reject(new Error(`Process exited`)));
    test[kTransportPort] = await cdpRelayServerReady;
    return {
      transport: new SSEClientTransport(new URL(await sseEndpointPromise)), disposeTransport: () => new Promise<void>((resolve => {
        if (cp.exitCode)
          resolve();
        cp.on('exit', () => cp.kill());
        cp.kill();
      })),
      stderr,
    };
  }

  return {
    transport: new StdioClientTransport({
      command: 'node',
      args: [path.join(path.dirname(__filename), '../cli.js'), ...args],
      cwd: path.join(path.dirname(__filename), '..'),
      stderr: 'pipe',
      env: {
        ...process.env,
        DEBUG: 'pw:mcp:test',
        DEBUG_COLORS: '0',
        DEBUG_HIDE_DATE: '1',
      },
    }),
    stderr,
  };
}

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

export function formatOutput(output: string): string[] {
  return output.split('\n').map(line => line.replace(/^pw:mcp:test /, '').replace(/user data dir.*/, 'user data dir').trim()).filter(Boolean);
}
