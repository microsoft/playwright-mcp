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

import dotenv from 'dotenv';

import * as mcpServer from '../mcp/server.js';
import { packageJSON } from '../utils/package.js';
import { Context } from './context.js';
import { perform } from './perform.js';
import { snapshot } from './snapshot.js';
import { toMcpTool } from '../mcp/tool.js';

import type { FullConfig } from '../config.js';
import type { ServerBackend } from '../mcp/server.js';
import type { Tool } from './tool.js';

export async function runLoopTools(config: FullConfig) {
  dotenv.config();
  const serverBackendFactory = {
    name: 'Playwright',
    nameInConfig: 'playwright-loop',
    version: packageJSON.version,
    create: () => new LoopToolsServerBackend(config)
  };
  await mcpServer.start(serverBackendFactory, config.server);
}

class LoopToolsServerBackend implements ServerBackend {
  private _config: FullConfig;
  private _context: Context | undefined;
  private _tools: Tool<any>[] = [perform, snapshot];

  constructor(config: FullConfig) {
    this._config = config;
  }

  async initialize() {
    this._context = await Context.create(this._config);
  }

  async listTools(): Promise<mcpServer.Tool[]> {
    return this._tools.map(tool => toMcpTool(tool.schema));
  }

  async callTool(name: string, args: mcpServer.CallToolRequest['params']['arguments']): Promise<mcpServer.CallToolResult> {
    const tool = this._tools.find(tool => tool.schema.name === name)!;
    const parsedArguments = tool.schema.inputSchema.parse(args || {});
    return await tool.handle(this._context!, parsedArguments);
  }

  serverClosed() {
    void this._context!.close();
  }
}
