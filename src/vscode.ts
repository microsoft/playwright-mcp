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
import z from 'zod';
import { BrowserContextFactory, ClientInfo } from './browserContextFactory.js';
import { FullConfig } from './config.js';
import { logUnhandledError } from './log.js';

function closeOnUIClose(context: playwright.BrowserContext) {
  context.on('close', () => context.browser()?.close({ reason: 'ui closed' }).catch(logUnhandledError));
  context.on('page', page => {
    page.on('close', () => {
      if (context.pages().length === 0)
        void context.close().catch(logUnhandledError);
    });
  });
}

class VSCodeContextFactory implements BrowserContextFactory {
  name = 'vscode';
  description = 'Connect to a browser running in the Playwright VS Code extension';

  constructor(private readonly _config: FullConfig) {}

  async createContext(clientInfo: ClientInfo, abortSignal: AbortSignal, _params: any): Promise<{ browserContext: playwright.BrowserContext; close: () => Promise<void>; }> {
    const params = z.object({ connectionString: z.string(), lib: z.string() }).parse(_params);

    const connectionString = new URL(params.connectionString);

    connectionString.searchParams.set('launch-options', JSON.stringify({
      ...this._config.browser.launchOptions,
      userDataDir: this._config.browser.userDataDir,
    }));
    const playwrightLibrary = playwright; // TODO: require playwright dynamically from `params.lib`
    const browser = await playwrightLibrary[this._config.browser.browserName].connect(connectionString.toString());

    const context: playwright.BrowserContext = browser.contexts()[0] ?? await browser.newContext(this._config.browser.contextOptions);

    // when the user closes the browser window, we should reconnect.
    closeOnUIClose(context);

    return {
      browserContext: context,
      close: async () => {
        // close the connection. in this mode, the browser will survive
        await browser.close();
      }
    };
  }
}

export function createVSCodeContextFactory(config: FullConfig): BrowserContextFactory {
  return new VSCodeContextFactory(config);
}
