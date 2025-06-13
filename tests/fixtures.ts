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
import net from 'net';
import { chromium } from 'playwright';
import { fork } from 'child_process';

import { test as baseTest, expect as baseExpect } from '@playwright/test';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { TestServer } from './testserver/index.ts';
import { ManualPromise } from '../src/manualPromise.js';

import type { Config } from '../config';
import type { BrowserContext } from 'playwright';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import type { Stream } from 'stream';

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
  startMcpExtension: (relayServerURL: string) => Promise<void>;
};

type WorkerFixtures = {
  _workerServers: { server: TestServer, httpsServer: TestServer };
};

export const test = baseTest.extend<TestFixtures & TestOptions, WorkerFixtures>({

  client: async ({ startClient }, use) => {
    const { client } = await startClient();
    await use(client);
  },

  visionClient: async ({ startClient }, use) => {
    const { client } = await startClient({ args: ['--vision'] });
    await use(client);
  },

  startClient: async ({ mcpHeadless, mcpBrowser, mcpMode, startMcpExtension }, use, testInfo) => {
    const userDataDir = mcpMode !== 'docker' ? testInfo.outputPath('user-data-dir') : undefined;
    const configDir = path.dirname(test.info().config.configFile!);
    let client: Client | undefined;

    await use(async options => {
      const args: string[] = [];
      if (userDataDir)
        args.push('--user-data-dir', userDataDir);
      if (process.env.CI && process.platform === 'linux')
        args.push('--no-sandbox');
      if (mcpHeadless)
        args.push('--headless');
      if (mcpBrowser)
        args.push(`--browser=${mcpBrowser}`);
      if (options?.args)
        args.push(...options.args);
      if (options?.config) {
        const configFile = testInfo.outputPath('config.json');
        await fs.promises.writeFile(configFile, JSON.stringify(options.config, null, 2));
        args.push(`--config=${path.relative(configDir, configFile)}`);
      }

      client = new Client({ name: options?.clientName ?? 'test', version: '1.0.0' });
      const { transport, stderr, relayServerURL } = await createTransport(args, mcpMode);
      let stderrBuffer = '';
      stderr?.on('data', data => {
        if (process.env.PWMCP_DEBUG)
          process.stderr.write(data);
        stderrBuffer += data.toString();
      });
      await client.connect(transport);
      if (mcpMode === 'extension')
        await startMcpExtension(relayServerURL!);
      await client.ping();
      return { client, stderr: () => stderrBuffer };
    });

    await client?.close();
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

  startMcpExtension: async ({ mcpMode, mcpHeadless }, use) => {
    let context: BrowserContext | undefined;
    await use(async (relayServerURL: string) => {
      if (mcpMode !== 'extension')
        throw new Error('Must be running in MCP extension mode to use this fixture.');
      const cdpPort = await findFreePort();
      const pathToExtension = path.join(url.fileURLToPath(import.meta.url), '../../extension');
      context = await chromium.launchPersistentContext('', {
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
      // Connect to the relay server.
      await popupPage.goto(new URL('/popup.html', context.serviceWorkers()[0].url()).toString());
      await popupPage.getByRole('textbox', { name: 'Bridge Server URL:' }).clear();
      await popupPage.getByRole('textbox', { name: 'Bridge Server URL:' }).fill(relayServerURL);
      await popupPage.getByRole('button', { name: 'Share This Tab' }).click();
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
  stderr: Stream | null,
  relayServerURL?: string,
}> {
  // NOTE: Can be removed when we drop Node.js 18 support and changed to import.meta.filename.
  const __filename = url.fileURLToPath(import.meta.url);
  if (mcpMode === 'docker') {
    const dockerArgs = ['run', '--rm', '-i', '--network=host', '-v', `${test.info().project.outputDir}:/app/test-results`];
    const transport = new StdioClientTransport({
      command: 'docker',
      args: [...dockerArgs, 'playwright-mcp-dev:latest', ...args],
    });
    return {
      transport,
      stderr: transport.stderr,
    };
  }
  if (mcpMode === 'extension') {
    const relay = fork(path.join(__filename, '../../cli.js'), [...args, '--extension', '--port=0'], {
      stdio: 'pipe'
    });
    const cdpRelayServerReady = new ManualPromise<string>();
    const sseEndpointPromise = new ManualPromise<string>();
    let stderrBuffer = '';
    relay.stderr!.on('data', data => {
      stderrBuffer += data.toString();
      const match = stderrBuffer.match(/Listening on (http:\/\/.*)/);
      if (match)
        sseEndpointPromise.resolve(match[1].toString());
      const extensionMatch = stderrBuffer.match(/CDP relay server started on (ws:\/\/.*\/extension)/);
      if (extensionMatch)
        cdpRelayServerReady.resolve(extensionMatch[1].toString());
    });
    relay.on('exit', () => {
      sseEndpointPromise.reject(new Error(`Process exited`));
      cdpRelayServerReady.reject(new Error(`Process exited`));
    });
    const relayServerURL = await cdpRelayServerReady;
    const sseEndpoint = await sseEndpointPromise;

    const transport = new SSEClientTransport(new URL(sseEndpoint));
    // We cannot just add  transport.onclose here as Client.connect() overrides it.
    const origClose = transport.close;
    transport.close = async () => {
      await origClose.call(transport);
      relay.kill();
    };
    return {
      transport,
      stderr: relay.stderr!,
      relayServerURL,
    };
  }

  const transport = new StdioClientTransport({
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
  });
  return {
    transport,
    stderr: transport.stderr!,
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

async function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, () => {
      const { port } = server.address() as net.AddressInfo;
      server.close(() => resolve(port));
    });
    server.on('error', reject);
  });
}

export function formatOutput(output: string): string[] {
  return output.split('\n').map(line => line.replace(/^pw:mcp:test /, '').replace(/user data dir.*/, 'user data dir').trim()).filter(Boolean);
}
