/**
 * Copyright (c) Microsoft Corporation.
 * Modified by Limetest.
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

import path from 'path';
import { chromium } from 'playwright';
import { Context, navigate } from '@limetest/core';
import type { ContextOptions } from '@limetest/core';

import { test as baseTest, expect as baseExpect } from '@playwright/test';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';

type Fixtures = {
  client: Client;
  startClient: (options?: { args?: string[] }) => Promise<Client>;
  wsEndpoint: string;
  cdpEndpoint: string;
  coreContext: Context;
};

export const test = baseTest.extend<Fixtures>({

  client: async ({ startClient }, use) => {
    await use(await startClient());
  },

  startClient: async ({ }, use, testInfo) => {
    const userDataDir = testInfo.outputPath('user-data-dir');
    let client: StdioClientTransport | undefined;

    use(async options => {
      const args = ['--headless', '--user-data-dir', userDataDir];
      if (options?.args)
        args.push(...options.args);
      const transport = new StdioClientTransport({
        command: 'node',
        args: [path.join(__dirname, '../packages/mcp/cli.js'), ...args],
      });
      const client = new Client({ name: 'test', version: '1.0.0' });
      await client.connect(transport);
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
    const port = 3200 + (+process.env.TEST_PARALLEL_INDEX!);
    const browser = await chromium.launchPersistentContext(testInfo.outputPath('user-data-dir'), {
      args: [`--remote-debugging-port=${port}`],
    });
    await use(`http://localhost:${port}`);
    await browser.close();
  },

  coreContext: async ({}, use, testInfo) => {
    const options: ContextOptions = {
      userDataDir: testInfo.outputPath(`user-data-dir-core-${testInfo.workerIndex}`),
      launchOptions: {
        headless: true,
        channel: 'chrome',
      },
    };
    const context = new Context(options);
    await use(context);
    await context.close();
  },
});

type Response = Awaited<ReturnType<Client['callTool']>>;

export const expect = baseExpect.extend({
  toHaveTextContent(response: Response, content: string | string[]) {
    const isNot = this.isNot;
    try {
      content = Array.isArray(content) ? content : [content];
      const texts = (response.content as any).map(c => c.text);
      if (isNot)
        baseExpect(texts).not.toEqual(content);
      else
        baseExpect(texts).toEqual(content);
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

export async function navigateAndGetSnapshot(coreContext: Context, htmlContent: string): Promise<string> {
  const navResult = await navigate(true).handle(coreContext, { url: `data:text/html,${encodeURIComponent(htmlContent)}` });
  const content = navResult.content[0];
  baseExpect(content.type).toBe('text');
  return content.text;
}

export function extractRef(snapshotText: string, regex: RegExp): string {
  const match = snapshotText.match(regex);
  baseExpect(match, `Ref regex ${regex} did not match in snapshot:\n${snapshotText}`).not.toBeNull();
  return match![1];
}
