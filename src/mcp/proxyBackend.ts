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

import { z } from 'zod';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { PingRequestSchema, TextContent } from '@modelcontextprotocol/sdk/types.js';
import { packageJSON } from '../package.js';
import { ServerBackend, ToolResponse, ToolSchema } from './server.js';
import { logUnhandledError } from '../log.js';

export class ProxyBackend implements ServerBackend {
  name = 'Playwright MCP Backend Proxy';
  version = packageJSON.version;

  private _client: Client;
  private _mcpUrl: string;
  private _tools: ToolSchema<any>[] = [];

  constructor(url: string) {
    this._mcpUrl = url;
    this._client = new Client({
      name: this.name,
      version: this.version
    });
    this._client.setRequestHandler(PingRequestSchema, async () => ({}));
  }

  async initialize(server: Server): Promise<void> {
    const transport = new StreamableHTTPClientTransport(new URL(this._mcpUrl));
    await this._client.connect(transport);
    await this._client.ping();
    const tools = await this._client.listTools();
    this._tools = tools.tools.map(tool => ({
      name: tool.name,
      title: tool.title ?? '',
      description: tool.description ?? '',
      inputSchema: tool.inputSchema ?? z.object({}),
      type: tool.annotations?.readOnlyHint ? 'readOnly' as const : 'destructive' as const,
    }));
  }

  tools(): ToolSchema<any>[] {
    return this._tools;
  }

  async callTool(schema: ToolSchema<any>, parsedArguments: any): Promise<ToolResponse> {
    const result = await this._client.callTool({
      name: schema.name,
      arguments: parsedArguments,
    });
    return result as unknown as ToolResponse;
  }

  serverClosed?(): void {
    void this._client.close().catch(logUnhandledError);
  }
}
