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
import { CallToolRequestSchema, ListToolsRequestSchema, Tool as McpTool } from '@modelcontextprotocol/sdk/types.js';
import { zodToJsonSchema } from 'zod-to-json-schema';

import { Context } from './context.js';

import type { Tool } from './tools/tool.js';
import type { Config } from '../config.js';

type MCPServerOptions = {
  name: string;
  version: string;
  tools: Tool[];
};

export function createServerWithTools(serverOptions: MCPServerOptions, config: Config): Server {
  const { name, version, tools } = serverOptions;
  const context = new Context(tools, config);
  const server = new Server({ name, version }, {
    capabilities: {
      tools: {},
    }
  });

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: tools.map(tool => ({
        name: tool.schema.name,
        description: tool.schema.description,
        inputSchema: zodToJsonSchema(tool.schema.inputSchema),
        annotations: {
          title: tool.schema.title,
          readOnlyHint: tool.schema.type === 'readOnly',
          destructiveHint: tool.schema.type === 'destructive',
          openWorldHint: true,
        },
      })) as McpTool[],
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async request => {
    const errorResult = (...messages: string[]) => ({
      content: [{ type: 'text', text: messages.join('\n') }],
      isError: true,
    });
    const tool = tools.find(tool => tool.schema.name === request.params.name);
    if (!tool)
      return errorResult(`Tool "${request.params.name}" not found`);


    const modalStates = context.modalStates().map(state => state.type);
    if (tool.clearsModalState && !modalStates.includes(tool.clearsModalState))
      return errorResult(`The tool "${request.params.name}" can only be used when there is related modal state present.`, ...context.modalStatesMarkdown());
    if (!tool.clearsModalState && modalStates.length)
      return errorResult(`Tool "${request.params.name}" does not handle the modal state.`, ...context.modalStatesMarkdown());

    try {
      return await context.run(tool, request.params.arguments);
    } catch (error) {
      return errorResult(String(error));
    }
  });

  const oldClose = server.close.bind(server);

  server.close = async () => {
    await oldClose();
    await context.close();
  };

  return server;
}

export class ServerList {
  private _servers: Server[] = [];
  private _serverFactory: () => Promise<Server>;

  constructor(serverFactory: () => Promise<Server>) {
    this._serverFactory = serverFactory;
  }

  async create() {
    const server = await this._serverFactory();
    this._servers.push(server);
    return server;
  }

  async close(server: Server) {
    const index = this._servers.indexOf(server);
    if (index !== -1)
      this._servers.splice(index, 1);
    await server.close();
  }

  async closeAll() {
    await Promise.all(this._servers.map(server => server.close()));
  }
}
