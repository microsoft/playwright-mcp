import { BrowserServerBackend } from './browserServerBackend.js';
import { resolveConfig } from './config.js';
import { contextFactory } from './browserContextFactory.js';
import * as mcpServer from './mcp/server.js';
import type { Config } from '../config.js';
import type { BrowserContext } from 'playwright';
import type { BrowserContextFactory } from './browserContextFactory.js';
import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
export async function createConnection(userConfig: Config = {}, contextGetter?: () => Promise<BrowserContext>): Promise<Server> {
  const config = await resolveConfig(userConfig);
  const factory = contextGetter ? new SimpleBrowserContextFactory(contextGetter) : contextFactory(config);
  return mcpServer.createServer(new BrowserServerBackend(config, [factory]), false);
}
class SimpleBrowserContextFactory implements BrowserContextFactory {
  name = 'custom';
  description = 'Connect to a browser using a custom context getter';
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
