import { BrowserServerBackend } from '../browser-server-backend.js';
import type { FullConfig } from '../config.js';
import { start } from '../mcp/transport.js';
import { ExtensionContextFactory } from './extensionContextFactory.js';
export async function runWithExtension(config: FullConfig) {
  const contextFactory = new ExtensionContextFactory(
    config.browser.launchOptions.channel || 'chrome'
  );
  const serverBackendFactory = () =>
    new BrowserServerBackend(config, [contextFactory]);
  await start(serverBackendFactory, config.server);
}
export function createExtensionContextFactory(config: FullConfig) {
  return new ExtensionContextFactory(
    config.browser.launchOptions.channel || 'chrome'
  );
}
