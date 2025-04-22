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
import { CallToolRequestSchema, ListResourcesRequestSchema, ListToolsRequestSchema, ReadResourceRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { zodToJsonSchema } from 'zod-to-json-schema';

import { Context } from './context';

import type { Tool } from './tools/tool';
import type { Resource } from './resources/resource';
import type { ContextOptions } from './context';

type Options = ContextOptions & {
  name: string;
  version: string;
  tools: Tool[];
  resources: Resource[],
};

export function createServerWithTools(options: Options): Server {
  const { name, version, tools, resources } = options;
  const context = new Context(tools, options);
  const server = new Server({ name, version }, {
    capabilities: {
      tools: {},
      resources: {},
    }
  });

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: tools.map(tool => ({
        name: tool.schema.name,
        description: tool.schema.description,
        inputSchema: zodToJsonSchema(tool.schema.inputSchema)
      })),
    };
  });

  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return { resources: resources.map(resource => resource.schema) };
  });

  server.setRequestHandler(CallToolRequestSchema, async request => {
    const tool = tools.find(tool => tool.schema.name === request.params.name);
    if (!tool) {
      return {
        content: [{ type: 'text', text: `Tool "${request.params.name}" not found` }],
        isError: true,
      };
    }

    const modalStates = context.modalStates().map(state => state.type);
    if ((tool.clearsModalState && !modalStates.includes(tool.clearsModalState)) ||
        (!tool.clearsModalState && modalStates.length)) {
      const text = [
        `Tool "${request.params.name}" does not handle the modal state.`,
        ...context.modalStatesMarkdown(),
      ].join('\n');
      return {
        content: [{ type: 'text', text }],
        isError: true,
      };
    }

    try {
      return await context.run(tool, request.params.arguments);
    } catch (error) {
      return {
        content: [{ type: 'text', text: String(error) }],
        isError: true,
      };
    }
  });

  server.setRequestHandler(ReadResourceRequestSchema, async request => {
    const resource = resources.find(resource => resource.schema.uri === request.params.uri);
    if (!resource)
      return { contents: [] };

    const contents = await resource.read(context, request.params.uri);
    return { contents };
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
