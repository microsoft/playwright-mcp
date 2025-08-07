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
import { logUnhandledError, testDebug } from './log.js';
import { createHash } from './utils.js';
import { outputFile } from './config.js';
export function contextFactory(config) {
    if (config.browser.remoteEndpoint)
        return new RemoteContextFactory(config);
    if (config.browser.cdpEndpoint)
        return new CdpContextFactory(config);
    if (config.browser.isolated)
        return new IsolatedContextFactory(config);
    return new PersistentContextFactory(config);
}
class BaseContextFactory {
    name;
    description;
    config;
    _browserPromise;
    _tracesDir;
    constructor(name, description, config) {
        this.name = name;
        this.description = description;
        this.config = config;
    }
    async _obtainBrowser() {
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
    async _doObtainBrowser() {
        throw new Error('Not implemented');
    }
    async createContext(clientInfo) {
        if (this.config.saveTrace)
            this._tracesDir = await outputFile(this.config, clientInfo.rootPath, `traces-${Date.now()}`);
        testDebug(`create browser context (${this.name})`);
        const browser = await this._obtainBrowser();
        const browserContext = await this._doCreateContext(browser);
        return { browserContext, close: () => this._closeBrowserContext(browserContext, browser) };
    }
    async _doCreateContext(browser) {
        throw new Error('Not implemented');
    }
    async _closeBrowserContext(browserContext, browser) {
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
    constructor(config) {
        super('isolated', 'Create a new isolated browser context', config);
    }
    async _doObtainBrowser() {
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
    async _doCreateContext(browser) {
        return browser.newContext(this.config.browser.contextOptions);
    }
}
class CdpContextFactory extends BaseContextFactory {
    constructor(config) {
        super('cdp', 'Connect to a browser over CDP', config);
    }
    async _doObtainBrowser() {
        return playwright.chromium.connectOverCDP(this.config.browser.cdpEndpoint);
    }
    async _doCreateContext(browser) {
        return this.config.browser.isolated ? await browser.newContext() : browser.contexts()[0];
    }
}
class RemoteContextFactory extends BaseContextFactory {
    constructor(config) {
        super('remote', 'Connect to a browser using a remote endpoint', config);
    }
    async _doObtainBrowser() {
        const url = new URL(this.config.browser.remoteEndpoint);
        url.searchParams.set('browser', this.config.browser.browserName);
        if (this.config.browser.launchOptions)
            url.searchParams.set('launch-options', JSON.stringify(this.config.browser.launchOptions));
        return playwright[this.config.browser.browserName].connect(String(url));
    }
    async _doCreateContext(browser) {
        return browser.newContext();
    }
}
class PersistentContextFactory {
    config;
    name = 'persistent';
    description = 'Create a new persistent browser context';
    _userDataDirs = new Set();
    constructor(config) {
        this.config = config;
    }
    async createContext(clientInfo) {
        await injectCdpPort(this.config.browser);
        testDebug('create browser context (persistent)');
        const userDataDir = this.config.browser.userDataDir ?? await this._createUserDataDir(clientInfo.rootPath);
        let tracesDir;
        if (this.config.saveTrace)
            tracesDir = await outputFile(this.config, clientInfo.rootPath, `traces-${Date.now()}`);
        this._userDataDirs.add(userDataDir);
        testDebug('lock user data dir', userDataDir);
        const browserType = playwright[this.config.browser.browserName];
        for (let i = 0; i < 5; i++) {
            try {
                const browserContext = await browserType.launchPersistentContext(userDataDir, {
                    tracesDir,
                    ...this.config.browser.launchOptions,
                    ...this.config.browser.contextOptions,
                    handleSIGINT: false,
                    handleSIGTERM: false,
                });
                const close = () => this._closeBrowserContext(browserContext, userDataDir);
                return { browserContext, close };
            }
            catch (error) {
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
    async _closeBrowserContext(browserContext, userDataDir) {
        testDebug('close browser context (persistent)');
        testDebug('release user data dir', userDataDir);
        await browserContext.close().catch(() => { });
        this._userDataDirs.delete(userDataDir);
        testDebug('close browser context complete (persistent)');
    }
    async _createUserDataDir(rootPath) {
        const dir = process.env.PWMCP_PROFILES_DIR_FOR_TEST ?? registryDirectory;
        const browserToken = this.config.browser.launchOptions?.channel ?? this.config.browser?.browserName;
        // Hesitant putting hundreds of files into the user's workspace, so using it for hashing instead.
        const rootPathToken = rootPath ? `-${createHash(rootPath)}` : '';
        const result = path.join(dir, `mcp-${browserToken}${rootPathToken}`);
        await fs.promises.mkdir(result, { recursive: true });
        return result;
    }
}
async function injectCdpPort(browserConfig) {
    if (browserConfig.browserName === 'chromium')
        browserConfig.launchOptions.cdpPort = await findFreePort();
}
async function findFreePort() {
    return new Promise((resolve, reject) => {
        const server = net.createServer();
        server.listen(0, () => {
            const { port } = server.address();
            server.close(() => resolve(port));
        });
        server.on('error', reject);
    });
}
