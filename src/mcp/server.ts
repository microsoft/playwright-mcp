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
import { ManualPromise } from '../manualPromise.js';
import { logUnhandledError } from '../log.js';

import type { ImageContent, TextContent } from '@modelcontextprotocol/sdk/types.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
export type { Server } from '@modelcontextprotocol/sdk/server/index.js';

export type ClientCapabilities = {
  roots?: {
    listRoots?: boolean
  };
};

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
  initialize?(server: Server): Promise<void>;
  tools(): ToolSchema<any>[];
  callTool(schema: ToolSchema<any>, rawArguments: any): Promise<ToolResponse>;
  serverClosed?(): void;
}

export type ServerBackendFactory = () => ServerBackend;

export async function connect(serverBackendFactory: ServerBackendFactory, transport: Transport, runHeartbeat: boolean) {
  const backend = serverBackendFactory();
  const server = createServer(backend, runHeartbeat);
  await server.connect(transport);
}

export function createServer(backend: ServerBackend, runHeartbeat: boolean): Server {
  const initializedPromise = new ManualPromise<void>();
  const server = new Server({ name: backend.name, version: backend.version }, {
    capabilities: {
      tools: {},
    }
  });

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const tools = backend.tools();
    return { tools: tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema instanceof z.ZodType ? zodToJsonSchema(tool.inputSchema) : tool.inputSchema,
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
    await initializedPromise;

    if (runHeartbeat && !heartbeatRunning) {
      heartbeatRunning = true;
      startHeartbeat(server);
    }

    const errorResult = (...messages: string[]) => ({
      content: [{ type: 'text', text: '### Result\n' + messages.join('\n') }],
      isError: true,
    });
    const tools = backend.tools();
    const tool = tools.find(tool => tool.name === request.params.name) as ToolSchema<any>;
    if (!tool)
      return errorResult(`Error: Tool "${request.params.name}" not found`);

    try {
      return await backend.callTool(tool, request.params.arguments || {});
    } catch (error) {
      return errorResult(String(error));
    }
  });
  addServerListener(server, 'initialized', () => {
    backend.initialize?.(server).then(() => initializedPromise.resolve()).catch(logUnhandledError);
  });
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
