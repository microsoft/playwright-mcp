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

import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import os from 'node:os';

import * as playwright from 'playwright';

import { logUnhandledError, testDebug } from './log.js';

import type { FullConfig } from './config.js';

export function contextFactory(browserConfig: FullConfig['browser']): BrowserContextFactory {
  if (browserConfig.remoteEndpoint)
    return new RemoteContextFactory(browserConfig);
  if (browserConfig.cdpEndpoint)
    return new CdpContextFactory(browserConfig);
  if (browserConfig.isolated)
    return new IsolatedContextFactory(browserConfig);
  return new PersistentContextFactory(browserConfig);
}

export interface BrowserContextFactory {
  createContext(clientInfo: { name: string, version: string }): Promise<{ browserContext: playwright.BrowserContext, close: () => Promise<void> }>;
}

class BaseContextFactory implements BrowserContextFactory {
  readonly browserConfig: FullConfig['browser'];
  protected _browserPromise: Promise<playwright.Browser> | undefined;
  readonly name: string;

  constructor(name: string, browserConfig: FullConfig['browser']) {
    this.name = name;
    this.browserConfig = browserConfig;
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
    throw new Error('Not implemented');
  }

  async createContext(): Promise<{ browserContext: playwright.BrowserContext, close: () => Promise<void> }> {
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
    if (browser.contexts().length === 1)
      this._browserPromise = undefined;
    await browserContext.close().catch(logUnhandledError);
    if (browser.contexts().length === 0) {
      testDebug(`close browser (${this.name})`);
      await browser.close().catch(logUnhandledError);
    }
  }
}

class IsolatedContextFactory extends BaseContextFactory {
  constructor(browserConfig: FullConfig['browser']) {
    super('isolated', browserConfig);
  }

  protected override async _doObtainBrowser(): Promise<playwright.Browser> {
    await injectCdpPort(this.browserConfig);
    const browserType = playwright[this.browserConfig.browserName];
    return browserType.launch({
      ...this.browserConfig.launchOptions,
      handleSIGINT: false,
      handleSIGTERM: false,
    }).catch(error => {
      if (error.message.includes('Executable doesn\'t exist'))
        throw new Error(`Browser specified in your config is not installed. Either install it (likely) or change the config.`);
      throw error;
    });
  }

  protected override async _doCreateContext(browser: playwright.Browser): Promise<playwright.BrowserContext> {
    return browser.newContext(this.browserConfig.contextOptions);
  }
}

class CdpContextFactory extends BaseContextFactory {
  constructor(browserConfig: FullConfig['browser']) {
    super('cdp', browserConfig);
  }

  protected override async _doObtainBrowser(): Promise<playwright.Browser> {
    return playwright.chromium.connectOverCDP(this.browserConfig.cdpEndpoint!);
  }

  protected override async _doCreateContext(browser: playwright.Browser): Promise<playwright.BrowserContext> {
    return this.browserConfig.isolated ? await browser.newContext() : browser.contexts()[0];
  }
}

class RemoteContextFactory extends BaseContextFactory {
  constructor(browserConfig: FullConfig['browser']) {
    super('remote', browserConfig);
  }

  protected override async _doObtainBrowser(): Promise<playwright.Browser> {
    const url = new URL(this.browserConfig.remoteEndpoint!);
    url.searchParams.set('browser', this.browserConfig.browserName);
    if (this.browserConfig.launchOptions)
      url.searchParams.set('launch-options', JSON.stringify(this.browserConfig.launchOptions));
    return playwright[this.browserConfig.browserName].connect(String(url));
  }

  protected override async _doCreateContext(browser: playwright.Browser): Promise<playwright.BrowserContext> {
    return browser.newContext();
  }
}

class PersistentContextFactory implements BrowserContextFactory {
  readonly browserConfig: FullConfig['browser'];
  private _userDataDirs = new Set<string>();

  constructor(browserConfig: FullConfig['browser']) {
    this.browserConfig = browserConfig;
  }

  async createContext(): Promise<{ browserContext: playwright.BrowserContext, close: () => Promise<void> }> {
    await injectCdpPort(this.browserConfig);
    testDebug('create browser context (persistent)');
    const userDataDir = this.browserConfig.userDataDir ?? await this._createUserDataDir();

    this._userDataDirs.add(userDataDir);
    testDebug('lock user data dir', userDataDir);

    const browserType = playwright[this.browserConfig.browserName];
    for (let i = 0; i < 5; i++) {
      try {
        const browserContext = await browserType.launchPersistentContext(userDataDir, {
          ...this.browserConfig.launchOptions,
          ...this.browserConfig.contextOptions,
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

  private async _createUserDataDir() {
    let cacheDirectory: string;
    if (process.platform === 'linux')
      cacheDirectory = process.env.XDG_CACHE_HOME || path.join(os.homedir(), '.cache');
    else if (process.platform === 'darwin')
      cacheDirectory = path.join(os.homedir(), 'Library', 'Caches');
    else if (process.platform === 'win32')
      cacheDirectory = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
    else
      throw new Error('Unsupported platform: ' + process.platform);
    const result = path.join(cacheDirectory, 'ms-playwright', `mcp-${this.browserConfig.launchOptions?.channel ?? this.browserConfig?.browserName}-profile`);
    await fs.promises.mkdir(result, { recursive: true });
    return result;
  }
}

async function injectCdpPort(browserConfig: FullConfig['browser']) {
  if (browserConfig.browserName === 'chromium')
    (browserConfig.launchOptions as any).cdpPort = await findFreePort();
}

async function findFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, () => {
      const { port } = server.address() as net.AddressInfo;
      server.close(() => resolve(port));
    });
    server.on('error', reject);
  });
}
