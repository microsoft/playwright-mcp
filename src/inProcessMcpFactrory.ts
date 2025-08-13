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


import { BrowserContextFactory } from './browserContextFactory.js';
import { BrowserServerBackend } from './browserServerBackend.js';
import { InProcessTransport } from './mcp/inProcessTransport.js';
import * as mcpServer from './mcp/server.js';

import type { FullConfig } from './config.js';
import type { MCPFactory } from './mcp/proxyBackend.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';

export class InProcessMCPFactory implements MCPFactory {
  name: string;
  description: string;

  private _contextFactory: BrowserContextFactory;
  private _config: FullConfig;

  constructor(contextFactory: BrowserContextFactory, config: FullConfig) {
    this.name = contextFactory.name;
    this.description = contextFactory.description;
    this._contextFactory = contextFactory;
    this._config = config;
  }

  async create(): Promise<Transport> {
    const delegate = mcpServer.createServer(new BrowserServerBackend(this._config, this._contextFactory), false);
    return new InProcessTransport(delegate);
  }
}
