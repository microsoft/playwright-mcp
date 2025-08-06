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

import fs from 'fs';
import net from 'net';
import path from 'path';

import * as playwright from 'playwright';
// @ts-ignore
import { registryDirectory } from 'playwright-core/lib/server/registry/index';
import { testDebug } from './log.js';
import { createHash } from './utils.js';
import { outputFile  } from './config.js';

import type { FullConfig } from './config.js';

export function contextFactory(config: FullConfig): BrowserContextFactory {
  if (config.browser.remoteEndpoint)
    return new RemoteContextFactory(config);
  if (config.browser.cdpEndpoint)
    return new CdpContextFactory(config);
  if (config.browser.isolated)
    return new IsolatedContextFactory(config);
  return new PersistentContextFactory(config);
}

export type ClientInfo = { name?: string, version?: string, rootPath?: string };

export interface BrowserContextFactory {
  readonly name: string;
  readonly description: string;
  createContext(clientInfo: ClientInfo, abortSignal: AbortSignal): Promise<{ browserContext: playwright.BrowserContext, close: () => Promise<void> }>;
}

class BaseContextFactory implements BrowserContextFactory {
  readonly name: string;
  readonly description: string;
  readonly config: FullConfig;
  protected _browserPromise: Promise<playwright.Browser> | undefined;
  protected _tracesDir: string | undefined;

  constructor(name: string, description: string, config: FullConfig) {
    this.name = name;
    this.description = description;
    this.config = config;
  }

  protected async _obtainBrowser(): Promise<playwright.Browser> {
    if (this._browserPromise)
      return this._browserPromise;
    testDebug(`obtain browser (${this.name})`);
    this._browserPromise = this._doObtainBrowser();
    void this._browserPromise.then(browser => {
      browser.on('disconnected', () => {
        this._browserPromise = undefined;
      });
    }).catch(() => {
      this._browserPromise = undefined;
    });
    return this._browserPromise;
  }

  protected async _doObtainBrowser(): Promise<playwright.Browser> {
    await injectCdpPort(this.config.browser);
    const browserType = playwright[this.config.browser.browserName];

    // Prepare launch options with extensions if specified
    const launchOptions = { ...this.config.browser.launchOptions };

    // For Chromium, we need to add extension loading arguments
    if (this.config.browser.browserName === 'chromium' && this.config.browser.extensions && this.config.browser.extensions.length > 0) {
      const extensionArgs = this._prepareExtensionArgs();
      if (extensionArgs.length > 0)
        launchOptions.args = [...(launchOptions.args || []), ...extensionArgs];

    }

    return browserType.launch({
      tracesDir: this._tracesDir,
      ...launchOptions,
      handleSIGINT: false,
      handleSIGTERM: false,
    }).catch(error => {
      if (error.message.includes('Executable doesn\'t exist'))
        throw new Error(`Browser specified in your config is not installed. Either install it (likely) or change the config.`);
      throw error;
    });
  }

  async createContext(clientInfo: ClientInfo): Promise<{ browserContext: playwright.BrowserContext, close: () => Promise<void> }> {
    if (this.config.saveTrace)
      this._tracesDir = await outputFile(this.config, clientInfo.rootPath, `traces-${Date.now()}`);

    testDebug(`create browser context (${this.name})`);
    const browser = await this._obtainBrowser();
    const browserContext = await this._doCreateContext(browser);
    return { browserContext, close: () => this._closeBrowserContext(browserContext, browser) };
  }

  protected async _doCreateContext(browser: playwright.Browser): Promise<playwright.BrowserContext> {
    throw new Error('Not implemented');
  }

  private async _closeBrowserContext(browserContext: playwright.BrowserContext, browser: playwright.Browser) {
    testDebug(`close browser context (${this.name})`);
    await browserContext.close().catch(() => {});
    await browser.close().catch(() => {});
    testDebug(`close browser context complete (${this.name})`);
  }

  private _prepareExtensionArgs(): string[] {
    if (!this.config.browser.extensions || this.config.browser.extensions.length === 0)
      return [];


    const args: string[] = [];
    const extensionPaths: string[] = [];

    for (const extension of this.config.browser.extensions) {
      if (this._isLocalPath(extension))
        extensionPaths.push(extension);
      else
        testDebug(`Invalid extension path: ${extension}. Only local paths are supported.`);

    }

    if (extensionPaths.length > 0) {
      args.push(`--disable-extensions-except=${extensionPaths.join(',')}`);
      args.push(`--load-extension=${extensionPaths.join(',')}`);
    }

    return args;
  }

  private _isLocalPath(extension: string): boolean {
    // Check if it's a local file path
    return extension.startsWith('/') || extension.startsWith('./') || extension.startsWith('../') ||
           (extension.includes('\\') && process.platform === 'win32') ||
           (extension.includes('/') && !extension.startsWith('http'));
  }


}

class IsolatedContextFactory extends BaseContextFactory {
  constructor(config: FullConfig) {
    super('isolated', 'Create a new isolated browser context', config);
  }

  protected override async _doObtainBrowser(): Promise<playwright.Browser> {
    await injectCdpPort(this.config.browser);
    const browserType = playwright[this.config.browser.browserName];
    return browserType.launch({
      tracesDir: this._tracesDir,
      ...this.config.browser.launchOptions,
      handleSIGINT: false,
      handleSIGTERM: false,
    }).catch(error => {
      if (error.message.includes('Executable doesn\'t exist'))
        throw new Error(`Browser specified in your config is not installed. Either install it (likely) or change the config.`);
      throw error;
    });
  }

  protected override async _doCreateContext(browser: playwright.Browser): Promise<playwright.BrowserContext> {
    return browser.newContext(this.config.browser.contextOptions);
  }
}

class CdpContextFactory extends BaseContextFactory {
  constructor(config: FullConfig) {
    super('cdp', 'Connect to a browser over CDP', config);
  }

  protected override async _doObtainBrowser(): Promise<playwright.Browser> {
    return playwright.chromium.connectOverCDP(this.config.browser.cdpEndpoint!);
  }

  protected override async _doCreateContext(browser: playwright.Browser): Promise<playwright.BrowserContext> {
    return this.config.browser.isolated ? await browser.newContext() : browser.contexts()[0];
  }
}

class RemoteContextFactory extends BaseContextFactory {
  constructor(config: FullConfig) {
    super('remote', 'Connect to a browser using a remote endpoint', config);
  }

  protected override async _doObtainBrowser(): Promise<playwright.Browser> {
    const url = new URL(this.config.browser.remoteEndpoint!);
    url.searchParams.set('browser', this.config.browser.browserName);
    if (this.config.browser.launchOptions)
      url.searchParams.set('launch-options', JSON.stringify(this.config.browser.launchOptions));
    return playwright[this.config.browser.browserName].connect(String(url));
  }

  protected override async _doCreateContext(browser: playwright.Browser): Promise<playwright.BrowserContext> {
    return browser.newContext();
  }
}

class PersistentContextFactory implements BrowserContextFactory {
  readonly config: FullConfig;
  readonly name = 'persistent';
  readonly description = 'Create a new persistent browser context';

  private _userDataDirs = new Set<string>();

  constructor(config: FullConfig) {
    this.config = config;
  }

  async createContext(clientInfo: ClientInfo): Promise<{ browserContext: playwright.BrowserContext, close: () => Promise<void> }> {
    await injectCdpPort(this.config.browser);
    testDebug('create browser context (persistent)');
    const userDataDir = this.config.browser.userDataDir ?? await this._createUserDataDir(clientInfo.rootPath);
    let tracesDir: string | undefined;
    if (this.config.saveTrace)
      tracesDir = await outputFile(this.config, clientInfo.rootPath, `traces-${Date.now()}`);

    this._userDataDirs.add(userDataDir);
    testDebug('lock user data dir', userDataDir);

    const browserType = playwright[this.config.browser.browserName];

    // Prepare launch options with extensions if specified
    const launchOptions = { ...this.config.browser.launchOptions };

    // For Chromium, we need to add extension loading arguments
    if (this.config.browser.browserName === 'chromium' && this.config.browser.extensions && this.config.browser.extensions.length > 0) {
      const extensionArgs = this._prepareExtensionArgs();
      if (extensionArgs.length > 0)
        launchOptions.args = [...(launchOptions.args || []), ...extensionArgs];

    }

    for (let i = 0; i < 5; i++) {
      try {
        const browserContext = await browserType.launchPersistentContext(userDataDir, {
          tracesDir,
          ...launchOptions,
          ...this.config.browser.contextOptions,
          handleSIGINT: false,
          handleSIGTERM: false,
        });
        const close = () => this._closeBrowserContext(browserContext, userDataDir);
        return { browserContext, close };
      } catch (error: any) {
        if (error.message.includes('Executable doesn\'t exist'))
          throw new Error(`Browser specified in your config is not installed. Either install it (likely) or change the config.`);
        if (error.message.includes('ProcessSingleton') || error.message.includes('Invalid URL')) {
          // User data directory is already in use, try again.
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }
        throw error;
      }
    }
    throw new Error(`Browser is already in use for ${userDataDir}, use --isolated to run multiple instances of the same browser`);
  }

  private async _closeBrowserContext(browserContext: playwright.BrowserContext, userDataDir: string) {
    testDebug('close browser context (persistent)');
    testDebug('release user data dir', userDataDir);
    await browserContext.close().catch(() => {});
    this._userDataDirs.delete(userDataDir);
    testDebug('close browser context complete (persistent)');
  }

  private async _createUserDataDir(rootPath: string | undefined) {
    const dir = process.env.PWMCP_PROFILES_DIR_FOR_TEST ?? registryDirectory;
    const browserToken = this.config.browser.launchOptions?.channel ?? this.config.browser?.browserName;
    // Hesitant putting hundreds of files into the user's workspace, so using it for hashing instead.
    const rootPathToken = rootPath ? `-${createHash(rootPath)}` : '';
    const result = path.join(dir, `mcp-${browserToken}${rootPathToken}`);
    await fs.promises.mkdir(result, { recursive: true });
    return result;
  }

  private _prepareExtensionArgs(): string[] {
    if (!this.config.browser.extensions || this.config.browser.extensions.length === 0)
      return [];


    const args: string[] = [];
    const extensionPaths: string[] = [];

    for (const extension of this.config.browser.extensions) {
      if (this._isLocalPath(extension))
        extensionPaths.push(extension);
      else
        testDebug(`Invalid extension path: ${extension}. Only local paths are supported.`);

    }

    if (extensionPaths.length > 0) {
      args.push(`--disable-extensions-except=${extensionPaths.join(',')}`);
      args.push(`--load-extension=${extensionPaths.join(',')}`);
    }

    return args;
  }

  private _isLocalPath(extension: string): boolean {
    // Check if it's a local file path
    return extension.startsWith('/') || extension.startsWith('./') || extension.startsWith('../') ||
           (extension.includes('\\') && process.platform === 'win32') ||
           (extension.includes('/') && !extension.startsWith('http'));
  }


}

async function injectCdpPort(browserConfig: FullConfig['browser']) {
  if (browserConfig.browserName === 'chromium')
    (browserConfig.launchOptions as any).cdpPort = await findFreePort();
}

async function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, () => {
      const { port } = server.address() as net.AddressInfo;
      server.close(() => resolve(port));
    });
    server.on('error', reject);
  });
}
