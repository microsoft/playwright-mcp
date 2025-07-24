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
import { Response } from './response.js';
import { packageJSON } from './package.js';
import { FullConfig } from './config.js';
import { SessionLog } from './sessionLog.js';
import { logUnhandledError } from './log.js';
import type { BrowserContextFactory } from './browserContextFactory.js';
import type { Tool } from './tools/tool.js';

export async function createMCPServer(config: FullConfig, tools: Tool<any>[], browserContextFactory: BrowserContextFactory): Promise<Server> {
  const context = new Context(tools, config, browserContextFactory);
  const server = new Server({ name: 'Playwright', version: packageJSON.version }, {
    capabilities: {
      tools: {},
    }
  });

  const sessionLog = config.saveSession ? await SessionLog.create(config) : undefined;

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

    try {
      const response = new Response(context, request.params.name, request.params.arguments || {});
      await tool.handle(context, tool.schema.inputSchema.parse(request.params.arguments || {}), response);
      if (sessionLog)
        await sessionLog.log(response);
      return await response.serialize();
    } catch (error) {
      return errorResult(String(error));
    }
  });

  server.oninitialized = () => {
    context.clientVersion = server.getClientVersion();
  };

  server.onclose = () => {
    void context.dispose().catch(logUnhandledError);
  };

  return server;
}
