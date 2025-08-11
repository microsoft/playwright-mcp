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

import { Server } from '@modelcontextprotocol/sdk/server/index.js';

import { z } from 'zod';
import { ServerBackend, ToolResponse, ToolSchema } from './server.js';
import { defineTool, Tool } from '../tools/tool.js';
import { packageJSON } from '../package.js';
import { logUnhandledError } from '../log.js';

import type { Client } from '@modelcontextprotocol/sdk/client/index.js';

type NonEmptyArray<T> = [T, ...T[]];

export type ClientFactory = {
  name: string;
  description: string;
  create(): Promise<Client>;
};

export type ClientFactoryList = NonEmptyArray<ClientFactory>;

export class ProxyBackend implements ServerBackend {
  name = 'Playwright MCP Client Switcher';
  version = packageJSON.version;

  private _clientFactories: ClientFactoryList;
  private _currentClient: Client | undefined;
  private _contextSwitchTool: Tool<any>;
  private _tools: ToolSchema<any>[] = [];

  constructor(clientFactories: ClientFactoryList) {
    this._clientFactories = clientFactories;
    this._contextSwitchTool = this._defineContextSwitchTool();
  }

  async initialize(server: Server): Promise<void> {
    await this._setCurrentClient(this._clientFactories[0]);
  }

  tools(): ToolSchema<any>[] {
    if (this._clientFactories.length === 1)
      return this._tools;
    return [
      ...this._tools,
      this._contextSwitchTool.schema,
    ];
  }

  async callTool(schema: ToolSchema<any>, rawArguments: any): Promise<ToolResponse> {
    if (schema.name === this._contextSwitchTool.schema.name)
      return this._callContextSwitchTool(rawArguments);
    const result = await this._currentClient!.callTool({
      name: schema.name,
      arguments: rawArguments,
    });
    return result as unknown as ToolResponse;
  }

  serverClosed?(): void {
    void this._currentClient?.close().catch(logUnhandledError);
  }

  private async _callContextSwitchTool(params: any): Promise<ToolResponse> {
    try {
      const factory = this._clientFactories.find(factory => factory.name === params.name);
      if (!factory)
        throw new Error('Unknown connection method: ' + params.name);

      await this._setCurrentClient(factory);
      return {
        content: [{ type: 'text', text: '### Result\nSuccessfully changed connection method.\n' }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `### Result\nError: ${error}\n` }],
        isError: true,
      };
    }
  }

  private _defineContextSwitchTool(): Tool<any> {
    return defineTool({
      capability: 'core',

      schema: {
        name: 'browser_connect',
        title: 'Connect to a browser context',
        description: [
          'Connect to a browser using one of the available methods:',
          ...this._clientFactories.map(factory => `- "${factory.name}": ${factory.description}`),
        ].join('\n'),
        inputSchema: z.object({
          name: z.enum(this._clientFactories.map(factory => factory.name) as [string, ...string[]]).default(this._clientFactories[0].name).describe('The method to use to connect to the browser'),
        }),
        type: 'readOnly',
      },

      async handle() {
        throw new Error('Unreachable');
      }
    });
  }

  private async _setCurrentClient(factory: ClientFactory) {
    await this._currentClient?.close();
    this._currentClient = await factory.create();
    const tools = await this._currentClient.listTools();
    this._tools = tools.tools.map(tool => ({
      name: tool.name,
      title: tool.title ?? '',
      description: tool.description ?? '',
      inputSchema: tool.inputSchema ?? z.object({}),
      type: tool.annotations?.readOnlyHint ? 'readOnly' as const : 'destructive' as const,
    }));
  }
}
