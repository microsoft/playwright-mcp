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

import { fileURLToPath } from 'url';
import { z } from 'zod';
import { FullConfig } from './config.js';
import { Context, ContextOptions } from './context.js';
import { logUnhandledError } from './log.js';
import { Response } from './response.js';
import { SessionLog } from './sessionLog.js';
import { filteredTools } from './tools.js';
import { packageJSON } from './package.js';
import { defineTool  } from './tools/tool.js';

import * as mcpServer from './mcp/server.js';
import type { Tool } from './tools/tool.js';
import type { BrowserContextFactory } from './browserContextFactory.js';
import type { ServerBackend } from './mcp/server.js';

type NonEmptyArray<T> = [T, ...T[]];

export type FactoryList = NonEmptyArray<BrowserContextFactory>;

export class BrowserServerBackend implements ServerBackend {
  name = 'Playwright';
  version = packageJSON.version;

  private _tools: Tool[];
  private _context: Context | undefined;
  private _sessionLog: SessionLog | undefined;
  private _config: FullConfig;
  private _browserContextFactory: BrowserContextFactory;
  private _browserContextFactories: FactoryList;

  onChangeProxyTarget: ServerBackend['onChangeProxyTarget'];

  constructor(config: FullConfig, factories: FactoryList) {
    this._config = config;
    this._browserContextFactory = factories[0];
    this._browserContextFactories = factories;
    this._tools = filteredTools(config);
  }

  async initialize(info: mcpServer.InitializeInfo): Promise<void> {
    let rootPath: string | undefined;
    if (info.roots) {
      const firstRootUri = info.roots.roots[0]?.uri;
      const url = firstRootUri ? new URL(firstRootUri) : undefined;
      rootPath = url ? fileURLToPath(url) : undefined;
    }

    this._defineContextSwitchTool(mcpServer.isVSCode(info.clientVersion));

    this._sessionLog = this._config.saveSession ? await SessionLog.create(this._config, rootPath) : undefined;
    this._context = new Context({
      tools: this._tools,
      config: this._config,
      browserContextFactory: this._browserContextFactory,
      sessionLog: this._sessionLog,
      clientInfo: { ...info.clientVersion, rootPath },
    });
  }

  tools(): mcpServer.ToolSchema<any>[] {
    return this._tools.map(tool => tool.schema);
  }

  async callTool(schema: mcpServer.ToolSchema<any>, parsedArguments: any) {
    const context = this._context!;
    const response = new Response(context, schema.name, parsedArguments);
    const tool = this._tools.find(tool => tool.schema.name === schema.name)!;
    context.setRunningTool(true);
    try {
      await tool.handle(context, parsedArguments, response);
      await response.finish();
      this._sessionLog?.logResponse(response);
    } catch (error: any) {
      response.addError(String(error));
    } finally {
      context.setRunningTool(false);
    }
    return response.serialize();
  }

  serverClosed() {
    void this._context!.dispose().catch(logUnhandledError);
  }

  private _defineContextSwitchTool(isVSCode: boolean) {
    const contextSwitchers: { name: string, description: string, switch(options: any): Promise<void> }[] = [];
    for (const factory of this._browserContextFactories) {
      contextSwitchers.push({
        name: factory.name,
        description: factory.description,
        switch: async () => {
          await this._setContextFactory(factory);
        }
      });
    }

    const askForOptions = isVSCode;
    if (isVSCode) {
      contextSwitchers.push({
        name: 'vscode',
        description: 'TODO',
        switch: async (options: any) => {
          if (!options.connectionString || !options.lib)
            this.onChangeProxyTarget?.('', {});
          else
            this.onChangeProxyTarget?.('vscode', options);
        }
      });
    }

    if (contextSwitchers.length < 2)
      return;

    this._tools.push(defineTool<any>({
      capability: 'core',

      schema: {
        name: 'browser_connect',
        title: 'Connect to a browser context',
        description: [
          'Connect to a browser using one of the available methods:',
          ...contextSwitchers.map(({ name, description }) => `- "${name}": ${description}`),
        ].join('\n'),
        inputSchema: z.object({
          method: z.enum(contextSwitchers.map(c => c.name) as [string, ...string[]]).describe('The method to use to connect to the browser'),
          options: askForOptions ? z.object({}).optional().describe('options for the connection method') : z.void(),
        }),
        type: 'readOnly',
      },

      async handle(context, params, response) {
        const contextSwitcher = contextSwitchers.find(c => c.name === params.method);
        if (!contextSwitcher) {
          response.addError('Unknown connection method: ' + params.method);
          return;
        }
        await contextSwitcher.switch({});
        response.addResult('Successfully changed connection method.');
      }
    }));
  }

  private async _setContextFactory(newFactory: BrowserContextFactory) {
    if (this._context) {
      const options: ContextOptions = {
        ...this._context.options,
        browserContextFactory: newFactory,
      };
      await this._context.dispose();
      this._context = new Context(options);
    }
    this._browserContextFactory = newFactory;
  }
}
