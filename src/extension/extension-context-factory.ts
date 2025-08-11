import debug from 'debug';
import { type Browser, type BrowserContext, chromium } from 'playwright';
import type {
  BrowserContextFactory,
  ClientInfo,
} from '../browser-context-factory.js';
import { startHttpServer } from '../http-server.js';
import { CDPRelayServer } from './cdp-relay.js';

const debugLogger = debug('pw:mcp:relay');
export class ExtensionContextFactory implements BrowserContextFactory {
  name = 'extension';
  description = 'Connect to a browser using the Playwright MCP extension';
  private readonly _browserChannel: string;
  private readonly _userDataDir?: string;
  private _relayPromise: Promise<CDPRelayServer> | undefined;
  private _browserPromise: Promise<Browser> | undefined;
  constructor(browserChannel: string, userDataDir?: string) {
    this._browserChannel = browserChannel;
    this._userDataDir = userDataDir;
  }
  async createContext(
    clientInfo: ClientInfo,
    abortSignal: AbortSignal
  ): Promise<{
    browserContext: BrowserContext;
    close: () => Promise<void>;
  }> {
    // First call will establish the connection to the extension.
    this._browserPromise ??= this._obtainBrowser(clientInfo, abortSignal);
    const browser = await this._browserPromise;
    return {
      browserContext: browser.contexts()[0],
      close: async () => {
        debugLogger('close() called for browser context');
        await browser.close();
        this._browserPromise = undefined;
      },
    };
  }
  private async _obtainBrowser(
    clientInfo: ClientInfo,
    abortSignal: AbortSignal
  ): Promise<Browser> {
    this._relayPromise ??= this._startRelay(abortSignal);
    const relay = await this._relayPromise;
    abortSignal.throwIfAborted();
    await relay.ensureExtensionConnectionForMCPContext(clientInfo, abortSignal);
    const browser = await chromium.connectOverCDP(relay.cdpEndpoint());
    browser.on('disconnected', () => {
      this._browserPromise = undefined;
      debugLogger('Browser disconnected');
    });
    return browser;
  }
  private async _startRelay(abortSignal: AbortSignal) {
    const httpServer = await startHttpServer({});
    const cdpRelayServer = new CDPRelayServer(httpServer, this._browserChannel);
    debugLogger(
      `CDP relay server started, extension endpoint: ${cdpRelayServer.extensionEndpoint()}.`
    );
    if (abortSignal.aborted) {
      cdpRelayServer.stop();
    } else {
      abortSignal.addEventListener('abort', () => cdpRelayServer.stop());
    }
    return cdpRelayServer;
  }
}
