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

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { BrowserContext } from 'playwright-core';
import { FullConfig } from '../config.js';
import * as mcpServer from '../mcp/server.js';
import { BrowserServerBackend } from '../browserServerBackend.js';
import { BrowserContextFactory, ClientInfo } from '../browserContextFactory.js';

const config: FullConfig = JSON.parse(process.argv[2]);
const connectionString = new URL(process.argv[3]);
const lib = process.argv[4];

const playwright = await import(lib).then(mod => mod.default ?? mod) as typeof import('playwright');

class VSCodeBrowserContextFactory implements BrowserContextFactory {
  name = 'unused';
  description = 'unused';

  async createContext(clientInfo: ClientInfo, abortSignal: AbortSignal): Promise<{ browserContext: BrowserContext; close: () => Promise<void>; }> {
    connectionString.searchParams.set('launch-options', JSON.stringify({
      ...config.browser.launchOptions,
      ...config.browser.contextOptions,
      userDataDir: config.browser.userDataDir,
    }));

    const browser = await playwright.chromium.connect(connectionString.toString());

    const context = browser.contexts()[0] ?? await browser.newContext(config.browser.contextOptions);

    return {
      browserContext: context,
      close: async () => {
        await browser.close();
      }
    };
  }
}

await mcpServer.connect(
    () => new BrowserServerBackend(config, new VSCodeBrowserContextFactory()),
    new StdioServerTransport(),
    false
);
