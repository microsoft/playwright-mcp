import { ExtensionContextFactory } from './extensionContextFactory.js';
import { BrowserServerBackend } from '../browserServerBackend.js';
import * as mcpTransport from '../mcp/transport.js';
import type { FullConfig } from '../config.js';
export async function runWithExtension(config: FullConfig) {
  const contextFactory = new ExtensionContextFactory(config.browser.launchOptions.channel || 'chrome');
  const serverBackendFactory = () => new BrowserServerBackend(config, [contextFactory]);
  await mcpTransport.start(serverBackendFactory, config.server);
}
export function createExtensionContextFactory(config: FullConfig) {
  return new ExtensionContextFactory(config.browser.launchOptions.channel || 'chrome');
}
