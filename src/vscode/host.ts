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
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { FullConfig } from '../config.js';
import { ClientFactory } from '../mcp/proxyBackend.js';
import { Server } from '../mcp/server.js';

class VSCodeClientFactory implements ClientFactory {
  name = 'vscode';
  description = 'Connect to a browser running in the Playwright VS Code extension';

  constructor(private readonly _config: FullConfig) {}

  async create(server: Server, options: any): Promise<Client> {
    if (typeof options.connectionString !== 'string')
      throw new Error('Missing options.connectionString');
    if (typeof options.lib !== 'string')
      throw new Error('Missing options.library');

    const client = new Client(server.getClientVersion()!);
    await client.connect(new StdioClientTransport({
      command: process.execPath,
      cwd: process.cwd(),
      args: [
        new URL('./main.js', import.meta.url).pathname,
        JSON.stringify(this._config),
        options.connectionString,
        options.lib,
      ],
    }));
    await client.ping();
    return client;
  }
}

export function createVSCodeClientFactory(config: FullConfig): ClientFactory {
  return new VSCodeClientFactory(config);
}
