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

import { BrowserServerBackend } from '../browserServerBackend.js';
import { FullConfig } from '../config.js';
import { logUnhandledError } from '../log.js';
import { ProcessRunner } from './process.js';
import { ClientCapabilities, Server } from '../mcp/server.js';
import type { BrowserContextFactory, ClientInfo } from '../browserContextFactory.js';
import type * as playwright from 'playwright';
import type * as mcpTypes from '@modelcontextprotocol/sdk/types.js';

export interface VSCodeInitParams {
  config: FullConfig;
  connectionString: string;
  lib: string;
}

export class VSCodeMain extends ProcessRunner {
  private _backend: BrowserServerBackend;
  constructor(params: VSCodeInitParams) {
    super();
    this._backend = new BrowserServerBackend(params.config, [new VSCodeContextFactory(params.config, params.connectionString, params.lib)]);
    this._backend.onChangeProxyTarget = target => this.dispatchEvent('changeProxyTarget', target);
  }

  async gracefullyClose() {
    this._backend.serverClosed?.();
  }

  async callTool({ toolName, parsedArguments }: { toolName: string; parsedArguments: any; }): Promise<any> {
    const tool = this._backend.tools().find(tool => tool.name === toolName);
    return await this._backend.callTool(tool!, parsedArguments);
  }

  async initialize(params: { capabilities: ClientCapabilities, roots: mcpTypes.ListRootsResult, clientVersion: mcpTypes.Implementation }) {
    // todo: change initialize interface to accept params
    const serverMock: Pick<Server, 'getClientCapabilities' | 'getClientVersion' | 'listRoots'> = {
      getClientCapabilities: () => params.capabilities,
      getClientVersion: () => params.clientVersion,
      listRoots: async () => params.roots,
    };
    await this._backend.initialize(serverMock as any);
  }
}

export const create = (params: VSCodeInitParams) => new VSCodeMain(params);

/**
 * turns the operating system's "Close" button into UI for closing the browser.
 * the user can use it to dismiss the foreground browser window, and the browser will be closed.
 */
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

  constructor(private readonly _config: FullConfig, private readonly _connectionString: string, private readonly _lib: string) {}

  async createContext(clientInfo: ClientInfo, abortSignal: AbortSignal): Promise<{ browserContext: playwright.BrowserContext; close: () => Promise<void>; }> {
    // TODO: what's the difference between the abortSignal and the close() retval?

    const connectionString = new URL(this._connectionString);
    connectionString.searchParams.set('launch-options', JSON.stringify({
      ...this._config.browser.launchOptions,
      ...this._config.browser.contextOptions,
      userDataDir: this._config.browser.userDataDir,
    }));
    const lib = await import(this._lib).then(mod => mod.default ?? mod) as typeof import('playwright');
    const browser = await lib[this._config.browser.browserName].connect(connectionString.toString());

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
