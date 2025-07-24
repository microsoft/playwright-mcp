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

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import dotenv from 'dotenv';
import { z } from 'zod';

import { contextFactory } from '../browserContextFactory.js';
import { BrowserServerBackend } from '../browserServerBackend.js';
import { Context } from '../context.js';
import { logUnhandledError } from '../log.js';
import { InProcessTransport } from '../mcp/inProcessTransport.js';
import * as mcpServer from '../mcp/server.js';
import * as mcpTransport from '../mcp/transport.js';
import { packageJSON } from '../package.js';
import { runTask } from './loop.js';
import { OpenAIDelegate } from './loopOpenAI.js';

import type { FullConfig } from '../config.js';
import type { ServerBackend } from '../mcp/server.js';

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
  const serverBackendFactory = () => new OneToolServerBackend(config);
  await mcpTransport.start(serverBackendFactory, config.server);
}

class OneToolServerBackend implements ServerBackend {
  readonly name = 'Playwright';
  readonly version = packageJSON.version;
  private _innerClient: Client | undefined;
  private _config: FullConfig;

  constructor(config: FullConfig) {
    this._config = config;
  }

  async initialize() {
    const client = new Client({ name: 'Playwright Proxy', version: '1.0.0' });
    const browserContextFactory = contextFactory(this._config.browser);
    const server = mcpServer.createServer(new BrowserServerBackend(this._config, browserContextFactory));
    await client.connect(new InProcessTransport(server));
    await client.ping();
    this._innerClient = client;
  }

  tools(): mcpServer.ToolSchema<any>[] {
    return [oneToolSchema];
  }

  async callTool(schema: mcpServer.ToolSchema<any>, parsedArguments: any): Promise<mcpServer.ToolResponse> {
    const delegate = new OpenAIDelegate();
    const result = await runTask(delegate, this._innerClient!, parsedArguments.task as string);
    return {
      content: [{ type: 'text', text: result }],
    };
  }

  serverClosed() {
    void Context.disposeAll().catch(logUnhandledError);
  }
}
