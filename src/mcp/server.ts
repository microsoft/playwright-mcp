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

export async function connect(serverBackendFactory: ServerBackendFactory, transport: Transport, runHeartbeat: boolean) {
  const backend = serverBackendFactory();
  await backend.initialize?.();
  const server = createServer(backend, runHeartbeat);
  await server.connect(transport);
}

export function createServer(backend: ServerBackend, runHeartbeat: boolean): Server {
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

  let heartbeatRunning = false;
  server.setRequestHandler(CallToolRequestSchema, async request => {
    if (runHeartbeat && !heartbeatRunning) {
      heartbeatRunning = true;
      startHeartbeat(server);
    }

    const errorResult = (...messages: string[]) => ({
      content: [{ type: 'text', text: '### Result\n' + messages.join('\n') }],
      isError: true,
    });
    const tool = tools.find(tool => tool.name === request.params.name) as ToolSchema<any>;
    if (!tool)
      return errorResult(`Error: Tool "${request.params.name}" not found`);

    try {
      return await backend.callTool(tool, tool.inputSchema.parse(request.params.arguments || {}));
    } catch (error) {
      return errorResult(String(error));
    }
  });

  addServerListener(server, 'initialized', () => backend.serverInitialized?.(server.getClientVersion()));
  addServerListener(server, 'close', () => backend.serverClosed?.());
  return server;
}

const startHeartbeat = (server: Server) => {
  const beat = () => {
    Promise.race([
      server.ping(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('ping timeout')), 5000)),
    ]).then(() => {
      setTimeout(beat, 3000);
    }).catch(() => {
      void server.close();
    });
  };

  beat();
};

function addServerListener(server: Server, event: 'close' | 'initialized', listener: () => void) {
  const oldListener = server[`on${event}`];
  server[`on${event}`] = () => {
    oldListener?.();
    listener();
  };
}
