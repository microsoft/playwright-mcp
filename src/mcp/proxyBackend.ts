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

import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { ListRootsRequestSchema, PingRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { logUnhandledError } from '../utils/log.js';
import { packageJSON } from '../utils/package.js';


import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import type { ToolDefinition, ServerBackend, ToolResponse } from './server.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';

type NonEmptyArray<T> = [T, ...T[]];

export type MCPFactory = {
  name: string;
  description: string;
  create(): Promise<Transport>;
};

export type MCPFactoryList = NonEmptyArray<MCPFactory>;

export class ProxyBackend implements ServerBackend {
  name = 'Playwright MCP Client Switcher';
  version = packageJSON.version;

  private _mcpFactories: MCPFactoryList;
  private _currentClient: Client | undefined;
  private _contextSwitchTool: ToolDefinition;
  private _tools: ToolDefinition[] = [];
  private _server: Server | undefined;

  constructor(clientFactories: MCPFactoryList) {
    this._mcpFactories = clientFactories;
    this._contextSwitchTool = this._defineContextSwitchTool();
  }

  async initialize(server: Server): Promise<void> {
    this._server = server;
    await this._setCurrentClient(this._mcpFactories[0]);
  }

  tools(): ToolDefinition[] {
    if (this._mcpFactories.length === 1)
      return this._tools;
    return [
      ...this._tools,
      this._contextSwitchTool,
    ];
  }

  async callTool(name: string, rawArguments: any): Promise<ToolResponse> {
    if (name === this._contextSwitchTool.name)
      return this._callContextSwitchTool(rawArguments);
    const result = await this._currentClient!.callTool({
      name,
      arguments: rawArguments,
    });
    return result as unknown as ToolResponse;
  }

  serverClosed?(): void {
    void this._currentClient?.close().catch(logUnhandledError);
  }

  private async _callContextSwitchTool(params: any): Promise<ToolResponse> {
    try {
      const factory = this._mcpFactories.find(factory => factory.name === params.name);
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

  private _defineContextSwitchTool(): ToolDefinition {
    return {
      name: 'browser_connect',
      description: [
        'Connect to a browser using one of the available methods:',
        ...this._mcpFactories.map(factory => `- "${factory.name}": ${factory.description}`),
      ].join('\n'),
      inputSchema: zodToJsonSchema(z.object({
        name: z.enum(this._mcpFactories.map(factory => factory.name) as [string, ...string[]]).default(this._mcpFactories[0].name).describe('The method to use to connect to the browser'),
      }), { strictUnions: true }) as ToolDefinition['inputSchema'],
      annotations: {
        title: 'Connect to a browser context',
        readOnlyHint: true,
        openWorldHint: false,
      },
    };
  }

  private async _setCurrentClient(factory: MCPFactory) {
    await this._currentClient?.close();
    this._currentClient = undefined;

    const client = new Client({ name: 'Playwright MCP Proxy', version: packageJSON.version });
    client.registerCapabilities({
      roots: {
        listRoots: true,
      },
    });
    client.setRequestHandler(ListRootsRequestSchema, async () => {
      const clientName = this._server!.getClientVersion()?.name;
      if (this._server!.getClientCapabilities()?.roots && (
        clientName === 'Visual Studio Code' ||
        clientName === 'Visual Studio Code - Insiders')) {
        const { roots } = await this._server!.listRoots();
        return { roots };
      }
      return { roots: [] };
    });
    client.setRequestHandler(PingRequestSchema, () => ({}));

    const transport = await factory.create();
    await client.connect(transport);

    this._currentClient = client;
    const tools = await this._currentClient.listTools();
    this._tools = tools.tools;
  }
}
