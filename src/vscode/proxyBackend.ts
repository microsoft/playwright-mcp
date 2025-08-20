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


import { VSCodeMCPFactory } from './host.js';
import { FullConfig } from '../config.js';
import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import type { ServerBackend } from '../mcp/server.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import type { Root, Tool, CallToolResult, CallToolRequest } from '@modelcontextprotocol/sdk/types.js';

export type MCPProvider = {
  name: string;
  description: string;
  connect(): Promise<Transport>;
};

const contextSwitchOptions = z.object({
  connectionString: z.string().optional().describe('The connection string to use to connect to the browser'),
  lib: z.string().optional().describe('The library to use for the connection'),
});

export class VSCodeProxyBackend implements ServerBackend {
  name = 'Playwright MCP Client Switcher';
  version = packageJSON.version;

  private _currentClient: Client | undefined;
  private _contextSwitchTool: Tool;
  private _roots: Root[] = [];

  constructor(private readonly _config: FullConfig, private readonly _defaultProvider: MCPProvider) {
    this._contextSwitchTool = this._defineContextSwitchTool();
  }

  async initialize(server: Server): Promise<void> {
    const version = server.getClientVersion();
    const capabilities = server.getClientCapabilities();
    if (capabilities?.roots && version && clientsWithRoots.includes(version.name)) {
      const { roots } = await server.listRoots();
      this._roots = roots;
    }

    await this._setCurrentClient(this._defaultProvider);
  }

  async listTools(): Promise<Tool[]> {
    const response = await this._currentClient!.listTools();
    return [
      ...response.tools,
      this._contextSwitchTool,
    ];
  }

  async callTool(name: string, args: CallToolRequest['params']['arguments']): Promise<CallToolResult> {
    if (name === this._contextSwitchTool.name)
      return this._callContextSwitchTool(args as any);
    return await this._currentClient!.callTool({
      name,
      arguments: args,
    }) as CallToolResult;
  }

  serverClosed?(): void {
    void this._currentClient?.close().catch(logUnhandledError);
  }

  private async _callContextSwitchTool(params: z.infer<typeof contextSwitchOptions>): Promise<CallToolResult> {
    if (!params.connectionString || !params.lib) {
      await this._setCurrentClient(this._defaultProvider);
      return {
        content: [{ type: 'text', text: '### Result\nSuccessfully disconnected.\n' }],
      };
    }

    await this._setCurrentClient(new VSCodeMCPFactory(this._config, params.connectionString, params.lib));
    return {
      content: [{ type: 'text', text: '### Result\nSuccessfully connected.\n' }],
    };
  }

  private _defineContextSwitchTool(): Tool {
    return {
      name: 'browser_connect',
      description: 'Connect to a browser running in VS Code.',
      inputSchema: zodToJsonSchema(contextSwitchOptions, { strictUnions: true }) as Tool['inputSchema'],
      annotations: {
        title: 'Connect to a browser running in VS Code.',
        readOnlyHint: true,
        openWorldHint: false,
      },
    };
  }

  private async _setCurrentClient(factory: MCPProvider) {
    await this._currentClient?.close();
    this._currentClient = undefined;

    const client = new Client({ name: 'Playwright MCP Proxy', version: packageJSON.version });
    client.registerCapabilities({
      roots: {
        listRoots: true,
      },
    });
    client.setRequestHandler(ListRootsRequestSchema, () => ({ roots: this._roots }));
    client.setRequestHandler(PingRequestSchema, () => ({}));

    const transport = await factory.connect();
    await client.connect(transport);
    this._currentClient = client;
  }
}

const clientsWithRoots = ['Visual Studio Code', 'Visual Studio Code - Insiders'];

export async function runLoopTools(config: FullConfig) {
  const serverBackendFactory = () => new LoopToolsServerBackend(config);
  await mcpTransport.start(serverBackendFactory, config.server);
}
