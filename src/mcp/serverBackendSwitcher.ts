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
import { ServerBackend, ServerBackendFactory, ToolResponse, ToolSchema } from './server.js';
import { defineTool, Tool } from '../tools/tool.js';
import { packageJSON } from '../package.js';

type NonEmptyArray<T> = [T, ...T[]];
export type BackendFactoryList = NonEmptyArray<ServerBackendFactory>;

export class ServerBackendSwitcher implements ServerBackend {
  name = 'Playwright Server Backend Switcher';
  version = packageJSON.version;

  private _backendFactories: BackendFactoryList;
  private _currentBackend: ServerBackend;
  private _contextSwitchTool: Tool<any>;
  private _server: Server | undefined;

  constructor(backendFactories: BackendFactoryList) {
    this._backendFactories = backendFactories;
    this._currentBackend = this._backendFactories[0].create();
    this._contextSwitchTool = this._defineContextSwitchTool();
  }

  async initialize(server: Server): Promise<void> {
    this._server = server;
    await this._currentBackend.initialize?.(server);
  }

  tools(): ToolSchema<any>[] {
    if (this._backendFactories.length === 1)
      return this._currentBackend.tools();
    return [
      ...this._currentBackend.tools(),
      this._contextSwitchTool.schema,
    ];
  }

  callTool(schema: ToolSchema<any>, parsedArguments: any): Promise<ToolResponse> {
    if (schema.name === this._contextSwitchTool.schema.name)
      return this._callContextSwitchTool(parsedArguments);
    return this._currentBackend.callTool(schema, parsedArguments);
  }

  serverClosed?(): void {
    this._server = undefined;
    this._currentBackend.serverClosed?.();
  }

  private async _callContextSwitchTool(params: any): Promise<ToolResponse> {
    try {
      const factory = this._backendFactories.find(factory => factory.name === params.name);
      if (!factory)
        throw new Error('Unknown connection method: ' + params.name);

      await this._setCurrentBackend(factory.create());
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
          ...this._backendFactories.map(factory => `- "${factory.name}": ${factory.description}`),
        ].join('\n'),
        inputSchema: z.object({
          name: z.enum(this._backendFactories.map(factory => factory.name) as [string, ...string[]]).default(this._backendFactories[0].name).describe('The method to use to connect to the browser'),
        }),
        type: 'readOnly',
      },

      async handle() {
        throw new Error('Unreachable');
      }
    });
  }

  private async _setCurrentBackend(backend: ServerBackend) {
    this._currentBackend = backend;
    if (!this._server)
      throw new Error('Server not initialized or closed');
    await this._currentBackend.initialize?.(this._server);
  }
}
