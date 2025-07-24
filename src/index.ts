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

import { createMCPServer } from './connection.js';
import { resolveConfig } from './config.js';
import { contextFactory } from './browserContextFactory.js';
import type { Config } from '../config.js';
import type { BrowserContext } from 'playwright';
import type { BrowserContextFactory } from './browserContextFactory.js';
import type { Server } from '@modelcontextprotocol/sdk/server/index.js';

export async function createConnection(userConfig: Config = {}, contextGetter?: () => Promise<BrowserContext>): Promise<Server> {
  const config = await resolveConfig(userConfig);
  const factory = contextGetter ? new SimpleBrowserContextFactory(contextGetter) : contextFactory(config.browser);
  return createMCPServer(config, factory);
}

class SimpleBrowserContextFactory implements BrowserContextFactory {
  private readonly _contextGetter: () => Promise<BrowserContext>;

  constructor(contextGetter: () => Promise<BrowserContext>) {
    this._contextGetter = contextGetter;
  }

  async createContext(): Promise<{ browserContext: BrowserContext, close: () => Promise<void> }> {
    const browserContext = await this._contextGetter();
    return {
      browserContext,
      close: () => browserContext.close()
    };
  }
}
