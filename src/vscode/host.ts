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
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { FullConfig } from '../config.js';
import { MCPFactory } from '../mcp/proxyBackend.js';

export class VSCodeMCPFactory implements MCPFactory {
  name = 'vscode';
  description = 'Connect to a browser running in the Playwright VS Code extension';

  constructor(private readonly _config: FullConfig) {}

  async create(options: any): Promise<Transport> {
    if (typeof options.connectionString !== 'string')
      throw new Error('Missing options.connectionString');
    if (typeof options.lib !== 'string')
      throw new Error('Missing options.lib');

    return new StdioClientTransport({
      command: process.execPath,
      cwd: process.cwd(),
      args: [
        new URL('./main.js', import.meta.url).pathname,
        JSON.stringify(this._config),
        options.connectionString,
        options.lib,
      ],
    });
  }
}
