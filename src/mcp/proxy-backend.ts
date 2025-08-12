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

import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { z } from 'zod';
import { logUnhandledError } from '../log.js';
import { packageJSON } from '../package.js';
import { defineTool, type Tool } from '../tools/tool.js';
import type { ServerBackend, ToolResponse, ToolSchema } from './server.js';

type NonEmptyArray<T> = [T, ...T[]];
type ContextSwitchParams = { name: string };

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
  private _contextSwitchTool: Tool<
    z.ZodObject<{ name: z.ZodEnum<[string, ...string[]]> }>
  >;
  private _tools: ToolSchema<z.ZodTypeAny>[] = [];

  constructor(clientFactories: ClientFactoryList) {
    this._clientFactories = clientFactories;
    this._contextSwitchTool = this._defineContextSwitchTool();
  }

  async initialize(_server: Server): Promise<void> {
    await this._setCurrentClient(this._clientFactories[0]);
  }

  tools(): ToolSchema<z.ZodTypeAny>[] {
    if (this._clientFactories.length === 1) {
      return this._tools;
    }
    return [...this._tools, this._contextSwitchTool.schema];
  }

  async callTool(
    schema: ToolSchema<z.ZodTypeAny>,
    rawArguments: Record<string, unknown> | undefined
  ): Promise<ToolResponse> {
    if (schema.name === this._contextSwitchTool.schema.name) {
      return this._callContextSwitchTool(rawArguments);
    }
    const result = await this._currentClient?.callTool({
      name: schema.name,
      arguments: rawArguments,
    });
    return result as unknown as ToolResponse;
  }

  serverClosed?(): void {
    this._currentClient?.close().catch(logUnhandledError);
  }

  private async _callContextSwitchTool(params: unknown): Promise<ToolResponse> {
    try {
      const contextParams = params as ContextSwitchParams;
      const factory = this._clientFactories.find(
        (f) => f.name === contextParams.name
      );
      if (!factory) {
        throw new Error(`Unknown connection method: ${contextParams.name}`);
      }

      await this._setCurrentClient(factory);
      return {
        content: [
          {
            type: 'text',
            text: '### Result\nSuccessfully changed connection method.\n',
          },
        ],
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `### Result\nError: ${error}\n` }],
        isError: true,
      };
    }
  }

  private _defineContextSwitchTool(): Tool<
    z.ZodObject<{ name: z.ZodEnum<[string, ...string[]]> }>
  > {
    return defineTool({
      capability: 'core',

      schema: {
        name: 'browser_connect',
        title: 'Connect to a browser context',
        description: [
          'Connect to a browser using one of the available methods:',
          ...this._clientFactories.map(
            (factory) => `- "${factory.name}": ${factory.description}`
          ),
        ].join('\n'),
        inputSchema: z.object({
          name: z
            .enum(
              this._clientFactories.map((factory) => factory.name) as [
                string,
                ...string[],
              ]
            )
            .describe('The method to use to connect to the browser'),
        }),
        type: 'readOnly' as const,
      },

      handle() {
        throw new Error('Unreachable');
      },
    }) as Tool<z.ZodObject<{ name: z.ZodEnum<[string, ...string[]]> }>>;
  }

  private async _setCurrentClient(factory: ClientFactory) {
    await this._currentClient?.close();
    this._currentClient = await factory.create();
    const tools = await this._currentClient.listTools();
    this._tools = tools.tools.map((tool) => ({
      name: tool.name,
      title: tool.title ?? '',
      description: tool.description ?? '',
      inputSchema: tool.inputSchema ? z.any() : z.object({}),
      type: tool.annotations?.readOnlyHint
        ? ('readOnly' as const)
        : ('destructive' as const),
    }));
  }
}
