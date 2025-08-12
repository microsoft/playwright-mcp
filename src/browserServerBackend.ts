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

import { fileURLToPath } from 'url';
import { FullConfig } from './config.js';
import { Context } from './context.js';
import { logUnhandledError } from './utils/log.js';
import { Response } from './response.js';
import { SessionLog } from './sessionLog.js';
import { filteredTools } from './tools.js';
import { packageJSON } from './utils/package.js';
import { toToolDefinition } from './tools/tool.js';

import type { Tool } from './tools/tool.js';
import type { BrowserContextFactory } from './browserContextFactory.js';
import type * as mcpServer from './mcp/server.js';
import type { ServerBackend } from './mcp/server.js';

export class BrowserServerBackend implements ServerBackend {
  name = 'Playwright';
  version = packageJSON.version;

  private _tools: Tool[];
  private _context: Context | undefined;
  private _sessionLog: SessionLog | undefined;
  private _config: FullConfig;
  private _browserContextFactory: BrowserContextFactory;

  constructor(config: FullConfig, factory: BrowserContextFactory) {
    this._config = config;
    this._browserContextFactory = factory;
    this._tools = filteredTools(config);
  }

  async initialize(server: mcpServer.Server): Promise<void> {
    const capabilities = server.getClientCapabilities() as mcpServer.ClientCapabilities;
    let rootPath: string | undefined;
    if (capabilities.roots && (
      server.getClientVersion()?.name === 'Visual Studio Code' ||
      server.getClientVersion()?.name === 'Visual Studio Code - Insiders')) {
      const { roots } = await server.listRoots();
      const firstRootUri = roots[0]?.uri;
      const url = firstRootUri ? new URL(firstRootUri) : undefined;
      rootPath = url ? fileURLToPath(url) : undefined;
    }
    this._sessionLog = this._config.saveSession ? await SessionLog.create(this._config, rootPath) : undefined;
    this._context = new Context({
      tools: this._tools,
      config: this._config,
      browserContextFactory: this._browserContextFactory,
      sessionLog: this._sessionLog,
      clientInfo: { ...server.getClientVersion(), rootPath },
    });
  }

  tools(): mcpServer.ToolDefinition[] {
    return this._tools.map(tool => toToolDefinition(tool.schema));
  }

  async callTool(name: string, rawArguments: any) {
    const tool = this._tools.find(tool => tool.schema.name === name)!;
    const parsedArguments = tool.schema.inputSchema.parse(rawArguments || {});
    const context = this._context!;
    const response = new Response(context, name, parsedArguments);
    context.setRunningTool(true);
    try {
      await tool.handle(context, parsedArguments, response);
      await response.finish();
      this._sessionLog?.logResponse(response);
    } catch (error: any) {
      response.addError(String(error));
    } finally {
      context.setRunningTool(false);
    }
    return response.serialize();
  }

  serverClosed() {
    void this._context!.dispose().catch(logUnhandledError);
  }
}
