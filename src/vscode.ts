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

import * as playwright from 'playwright';
import { BrowserContext } from 'playwright-core';
import z from 'zod';
import { BrowserContextFactory, ClientInfo } from './browserContextFactory.js';
import { FullConfig } from './config.js';

class VSCodeContextFactory implements BrowserContextFactory {
  name = 'vscode';
  description = 'Connect to a browser running in the Playwright VS Code extension';

  constructor(private readonly _config: FullConfig) {}

  async createContext(clientInfo: ClientInfo, abortSignal: AbortSignal, params: any): Promise<{ browserContext: BrowserContext; close: () => Promise<void>; }> {
    const { connectionString, lib } = z.object({ connectionString: z.string(), lib: z.string() }).parse(params);

    const playwrightLibrary = playwright; // TODO: require playwright dynamically from `lib`

    const browser = await playwrightLibrary.chromium.connect(connectionString);
    const context = browser.contexts()[0] ?? await browser.newContext(this._config.browser.contextOptions);
    return {
      browserContext: context,
      close: async () => {
        // in connect mode, browser.close() closes the connection, but not the browser.
        // closing the context ensures visible cleanup.
        await context.close();
        await browser.close();
      }
    };
  }
}

export function createVSCodeContextFactory(config: FullConfig): BrowserContextFactory {
  return new VSCodeContextFactory(config);
}
