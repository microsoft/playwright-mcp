import { BrowserServerBackend } from '../browser-server-backend.js';
import type { FullConfig } from '../config.js';
import { InProcessClientFactory } from '../inProcessClient.js';
import type { ClientFactory } from '../mcp/proxyBackend.js';
import { start } from '../mcp/transport.js';
import { ExtensionContextFactory } from './extension-context-factory.js';

export async function runWithExtension(config: FullConfig) {
  const contextFactory = createExtensionContextFactory(config);
  const factories = [contextFactory];
  const serverBackendFactory = () =>
    new BrowserServerBackend(config, factories);
  await start(serverBackendFactory, config.server);
}

export function createExtensionClientFactory(
  config: FullConfig
): ClientFactory {
  return new InProcessClientFactory(
    createExtensionContextFactory(config),
    config
  );
}

export function createExtensionContextFactory(config: FullConfig) {
  return new ExtensionContextFactory(
    config.browser.launchOptions.channel || 'chrome',
    config.browser.userDataDir
  );
}
