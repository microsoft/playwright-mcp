import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import type { BrowserContext } from 'playwright';
import type { Config } from '../config.js';
import type { BrowserContextFactory } from './browser-context-factory.js';
import { contextFactory } from './browser-context-factory.js';
import { BrowserServerBackend } from './browser-server-backend.js';
import { resolveConfig } from './config.js';
import { createServer } from './mcp/server.js';
export function createConnection(
  userConfig: Config = {},
  contextGetter?: () => Promise<BrowserContext>
): Server {
  const config = resolveConfig(userConfig);
  const factory = contextGetter
    ? new SimpleBrowserContextFactory(contextGetter)
    : contextFactory(config);
  return createServer(new BrowserServerBackend(config, [factory]), false);
}
class SimpleBrowserContextFactory implements BrowserContextFactory {
  name = 'custom';
  description = 'Connect to a browser using a custom context getter';
  private readonly _contextGetter: () => Promise<BrowserContext>;
  constructor(contextGetter: () => Promise<BrowserContext>) {
    this._contextGetter = contextGetter;
  }
  async createContext(): Promise<{
    browserContext: BrowserContext;
    close: () => Promise<void>;
  }> {
    const browserContext = await this._contextGetter();
    return {
      browserContext,
      close: () => browserContext.close(),
    };
  }
}
