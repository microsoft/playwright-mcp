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
import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { ListRootsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import type { BrowserContextFactory } from './browser-context-factory.js';
import { BrowserServerBackend } from './browser-server-backend.js';
import type { FullConfig } from './config.js';
import { InProcessTransport } from './mcp/in-process-transport.js';
import type { ClientFactory } from './mcp/proxy-backend.js';
import { createServer } from './mcp/server.js';
import { packageJSON } from './package.js';

export class InProcessClientFactory implements ClientFactory {
  name: string;
  description: string;

  private readonly _contextFactory: BrowserContextFactory;
  private readonly _config: FullConfig;

  constructor(contextFactory: BrowserContextFactory, config: FullConfig) {
    this.name = contextFactory.name;
    this.description = contextFactory.description;
    this._contextFactory = contextFactory;
    this._config = config;
  }

  async create(server: Server): Promise<Client> {
    const client = new Client(
      server.getClientVersion() ?? {
        name: this.name,
        version: packageJSON.version,
      }
    );
    const clientCapabilities = server.getClientCapabilities();
    if (clientCapabilities) {
      client.registerCapabilities(clientCapabilities);
    }

    if (clientCapabilities?.roots) {
      client.setRequestHandler(ListRootsRequestSchema, async () => {
        return await server.listRoots();
      });
    }

    const backend = new BrowserServerBackend(this._config, [
      this._contextFactory,
    ] as [BrowserContextFactory, ...BrowserContextFactory[]]);
    const delegate = createServer(backend, false);
    await client.connect(new InProcessTransport(delegate));
    await client.ping();
    return client;
  }
}
