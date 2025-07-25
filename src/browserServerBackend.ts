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

import { FullConfig } from './config.js';
import { Context } from './context.js';
import { logUnhandledError } from './log.js';
import { Response } from './response.js';
import { SessionLog } from './sessionLog.js';
import { filteredTools } from './tools.js';
import { packageJSON } from './package.js';

import type { BrowserContextFactory } from './browserContextFactory.js';
import type * as mcpServer from './mcp/server.js';
import type { ServerBackend } from './mcp/server.js';
import type { Tool } from './tools/tool.js';

export class BrowserServerBackend implements ServerBackend {
  name = 'Playwright';
  version = packageJSON.version;
  onclose?: () => void;

  private _tools: Tool[];
  private _context: Context;
  private _sessionLog: SessionLog | undefined;

  constructor(config: FullConfig, browserContextFactory: BrowserContextFactory) {
    this._tools = filteredTools(config);
    this._context = new Context(this._tools, config, browserContextFactory);
  }

  async initialize() {
    this._sessionLog = this._context.config.saveSession ? await SessionLog.create(this._context.config) : undefined;
  }

  tools(): mcpServer.ToolSchema<any>[] {
    return this._tools.map(tool => tool.schema);
  }

  async callTool(schema: mcpServer.ToolSchema<any>, parsedArguments: any) {
    const response = new Response(this._context, schema.name, parsedArguments);
    const tool = this._tools.find(tool => tool.schema.name === schema.name)!;
    await tool.handle(this._context, parsedArguments, response);
    if (this._sessionLog)
      await this._sessionLog.log(response);
    return await response.serialize();
  }

  serverInitialized(version: mcpServer.ClientVersion | undefined) {
    this._context.clientVersion = version;
  }

  serverClosed() {
    this.onclose?.();
    void this._context.dispose().catch(logUnhandledError);
  }
}
