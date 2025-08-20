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
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import type { FullConfig } from '../config.js';
import type { MCPProvider } from './proxyBackend.js';

export class VSCodeMCPFactory implements MCPProvider {
  name = 'vscode';
  description = 'Connect to a browser running in the Playwright VS Code extension';

  constructor(private readonly _config: FullConfig, private readonly _connectionString: string, private readonly _lib: string) {}

  async connect(): Promise<Transport> {
    return new StdioClientTransport({
      command: process.execPath,
      cwd: process.cwd(),
      args: [
        new URL('./main.js', import.meta.url).pathname,
        JSON.stringify(this._config),
        this._connectionString,
        this._lib,
      ],
    });
  }
}
