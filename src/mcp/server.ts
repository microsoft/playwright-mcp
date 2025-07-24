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
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { zodToJsonSchema } from 'zod-to-json-schema';

import type { ImageContent, Implementation, TextContent } from '@modelcontextprotocol/sdk/types.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';

export type ClientVersion = Implementation;

export type ToolResponse = {
  content: (TextContent | ImageContent)[];
  isError?: boolean;
};

export type ToolSchema<Input extends z.Schema> = {
  name: string;
  title: string;
  description: string;
  inputSchema: Input;
  type: 'readOnly' | 'destructive';
};

export type ToolHandler = (toolName: string, params: any) => Promise<ToolResponse>;

export interface ServerBackend {
  name: string;
  version: string;
  initialize?(): Promise<void>;
  tools(): ToolSchema<any>[];
  callTool(schema: ToolSchema<any>, parsedArguments: any): Promise<ToolResponse>;
  serverInitialized?(version: ClientVersion | undefined): void;
  serverClosed?(): void;
}

export type ServerBackendFactory = () => ServerBackend;

export async function connect(serverBackendFactory: ServerBackendFactory, transport: Transport) {
  const backend = serverBackendFactory();
  await backend.initialize?.();
  const server = createServer(backend);
  await server.connect(transport);
}

export function createServer(backend: ServerBackend): Server {
  const server = new Server({ name: backend.name, version: backend.version }, {
    capabilities: {
      tools: {},
    }
  });

  const tools = backend.tools();
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: zodToJsonSchema(tool.inputSchema),
      annotations: {
        title: tool.title,
        readOnlyHint: tool.type === 'readOnly',
        destructiveHint: tool.type === 'destructive',
        openWorldHint: true,
      },
    })) };
  });

  server.setRequestHandler(CallToolRequestSchema, async request => {
    const errorResult = (...messages: string[]) => ({
      content: [{ type: 'text', text: messages.join('\n') }],
      isError: true,
    });
    const tool = tools.find(tool => tool.name === request.params.name) as ToolSchema<any>;
    if (!tool)
      return errorResult(`Tool "${request.params.name}" not found`);

    try {
      return await backend.callTool(tool, tool.inputSchema.parse(request.params.arguments || {}));
    } catch (error) {
      return errorResult(String(error));
    }
  });

  if (backend.serverInitialized)
    server.oninitialized = () => backend.serverInitialized!(server.getClientVersion());
  if (backend.serverClosed)
    server.onclose = () => backend.serverClosed!();

  return server;
}
