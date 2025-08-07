import debug from 'debug';
import * as playwright from 'playwright';
import { startHttpServer } from '../httpServer.js';
import { CDPRelayServer } from './cdpRelay.js';
import type { BrowserContextFactory, ClientInfo } from '../browserContextFactory.js';
const debugLogger = debug('pw:mcp:relay');
export class ExtensionContextFactory implements BrowserContextFactory {
  name = 'extension';
  description = 'Connect to a browser using the Playwright MCP extension';
  private _browserChannel: string;
  private _relayPromise: Promise<CDPRelayServer> | undefined;
  private _browserPromise: Promise<playwright.Browser> | undefined;
  constructor(browserChannel: string) {
    this._browserChannel = browserChannel;
  }
  async createContext(clientInfo: ClientInfo, abortSignal: AbortSignal): Promise<{ browserContext: playwright.BrowserContext, close: () => Promise<void> }> {
    // First call will establish the connection to the extension.
    if (!this._browserPromise)
      this._browserPromise = this._obtainBrowser(clientInfo, abortSignal);
    const browser = await this._browserPromise;
    return {
      browserContext: browser.contexts()[0],
      close: async () => {
        debugLogger('close() called for browser context');
        await browser.close();
        this._browserPromise = undefined;
      }
    };
  }
  private async _obtainBrowser(clientInfo: ClientInfo, abortSignal: AbortSignal): Promise<playwright.Browser> {
    if (!this._relayPromise)
      this._relayPromise = this._startRelay(abortSignal);
    const relay = await this._relayPromise;
    abortSignal.throwIfAborted();
    await relay.ensureExtensionConnectionForMCPContext(clientInfo, abortSignal);
    const browser = await playwright.chromium.connectOverCDP(relay.cdpEndpoint());
    browser.on('disconnected', () => {
      this._browserPromise = undefined;
      debugLogger('Browser disconnected');
    });
    return browser;
  }
  private async _startRelay(abortSignal: AbortSignal) {
    const httpServer = await startHttpServer({});
    const cdpRelayServer = new CDPRelayServer(httpServer, this._browserChannel);
    debugLogger(`CDP relay server started, extension endpoint: ${cdpRelayServer.extensionEndpoint()}.`);
    if (abortSignal.aborted)
      cdpRelayServer.stop();
    else
      abortSignal.addEventListener('abort', () => cdpRelayServer.stop());
    return cdpRelayServer;
  }
}
