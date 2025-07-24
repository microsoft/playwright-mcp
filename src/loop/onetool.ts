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

import path from 'path';
import url from 'url';
import dotenv from 'dotenv';
import { z } from 'zod';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

import { OpenAIDelegate } from './loopOpenAI.js';
import { runTask } from './loop.js';
import { packageJSON } from '../package.js';
import * as mcpTransport from '../mcp/transport.js';

import type { FullConfig } from '../config.js';
import type { ServerBackend } from '../mcp/server.js';
import type * as mcpServer from '../mcp/server.js';

const __filename = url.fileURLToPath(import.meta.url);

const delegate = new OpenAIDelegate();

const oneToolSchema: mcpServer.ToolSchema<any> = {
  name: 'browser',
  title: 'Perform a task with the browser',
  description: 'Perform a task with the browser. It can click, type, export, capture screenshot, drag, hover, select options, etc.',
  inputSchema: z.object({
    task: z.string().describe('The task to perform with the browser'),
  }),
  type: 'readOnly',
};

export async function runOneTool(config: FullConfig) {
  dotenv.config();
  const serverBackendFactory = () => new OneToolServerBackend();
  await mcpTransport.start(serverBackendFactory, config.server);
}

class OneToolServerBackend implements ServerBackend {
  readonly name = 'Playwright';
  readonly version = packageJSON.version;
  private _innerClient: Client | undefined;

  async initialize() {
    const transport = new StdioClientTransport({
      command: 'node',
      args: [
        path.resolve(__filename, '../../../cli.js'),
      ],
      stderr: 'inherit',
      env: process.env as Record<string, string>,
    });

    const client = new Client({ name: 'Playwright Proxy', version: '1.0.0' });
    await client.connect(transport);
    await client.ping();
    this._innerClient = client;
  }

  tools(): mcpServer.ToolSchema<any>[] {
    return [oneToolSchema];
  }

  async callTool(schema: mcpServer.ToolSchema<any>, parsedArguments: any): Promise<mcpServer.ToolResponse> {
    const result = await runTask(delegate!, this._innerClient!, parsedArguments.task as string);
    return {
      content: [{ type: 'text', text: result }],
    };
  }
}
