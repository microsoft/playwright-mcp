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
import debug from 'debug';
import { logUnhandledError } from './log.js';
import { Tab } from './tab.js';
import { outputFile } from './config.js';
import { BatchExecutor } from './batch/batchExecutor.js';
const testDebug = debug('pw:mcp:test');
export class Context {
    tools;
    config;
    sessionLog;
    options;
    _browserContextPromise;
    _browserContextFactory;
    _tabs = [];
    _currentTab;
    _clientInfo;
    _batchExecutor;
    static _allContexts = new Set();
    _closeBrowserContextPromise;
    _isRunningTool = false;
    _abortController = new AbortController();
    constructor(options) {
        this.tools = options.tools;
        this.config = options.config;
        this.sessionLog = options.sessionLog;
        this.options = options;
        this._browserContextFactory = options.browserContextFactory;
        this._clientInfo = options.clientInfo;
        testDebug('create context');
        Context._allContexts.add(this);
    }
    static async disposeAll() {
        await Promise.all([...Context._allContexts].map(context => context.dispose()));
    }
    tabs() {
        return this._tabs;
    }
    currentTab() {
        return this._currentTab;
    }
    currentTabOrDie() {
        if (!this._currentTab)
            throw new Error('No open pages available. Use the "browser_navigate" tool to navigate to a page first.');
        return this._currentTab;
    }
    async newTab() {
        const { browserContext } = await this._ensureBrowserContext();
        const page = await browserContext.newPage();
        this._currentTab = this._tabs.find(t => t.page === page);
        return this._currentTab;
    }
    async selectTab(index) {
        const tab = this._tabs[index];
        if (!tab)
            throw new Error(`Tab ${index} not found`);
        await tab.page.bringToFront();
        this._currentTab = tab;
        return tab;
    }
    async ensureTab() {
        const { browserContext } = await this._ensureBrowserContext();
        if (!this._currentTab)
            await browserContext.newPage();
        return this._currentTab;
    }
    async closeTab(index) {
        const tab = index === undefined ? this._currentTab : this._tabs[index];
        if (!tab)
            throw new Error(`Tab ${index} not found`);
        const url = tab.page.url();
        await tab.page.close();
        return url;
    }
    async outputFile(name) {
        return outputFile(this.config, this._clientInfo.rootPath, name);
    }
    _onPageCreated(page) {
        const tab = new Tab(this, page, tab => this._onPageClosed(tab));
        this._tabs.push(tab);
        if (!this._currentTab)
            this._currentTab = tab;
    }
    _onPageClosed(tab) {
        const index = this._tabs.indexOf(tab);
        if (index === -1)
            return;
        this._tabs.splice(index, 1);
        if (this._currentTab === tab)
            this._currentTab = this._tabs[Math.min(index, this._tabs.length - 1)];
        if (!this._tabs.length)
            void this.closeBrowserContext();
    }
    async closeBrowserContext() {
        if (!this._closeBrowserContextPromise)
            this._closeBrowserContextPromise = this._closeBrowserContextImpl().catch(logUnhandledError);
        await this._closeBrowserContextPromise;
        this._closeBrowserContextPromise = undefined;
    }
    isRunningTool() {
        return this._isRunningTool;
    }
    setRunningTool(isRunningTool) {
        this._isRunningTool = isRunningTool;
    }
    /**
     * Gets or creates the batch executor for this context
     */
    getBatchExecutor() {
        if (!this._batchExecutor) {
            // Create tool registry from available tools
            const toolRegistry = new Map();
            for (const tool of this.tools)
                toolRegistry.set(tool.schema.name, tool);
            this._batchExecutor = new BatchExecutor(this, toolRegistry);
        }
        return this._batchExecutor;
    }
    async _closeBrowserContextImpl() {
        if (!this._browserContextPromise)
            return;
        testDebug('close context');
        const promise = this._browserContextPromise;
        this._browserContextPromise = undefined;
        await promise.then(async ({ browserContext, close }) => {
            if (this.config.saveTrace)
                await browserContext.tracing.stop();
            await close();
        });
    }
    async dispose() {
        this._abortController.abort('MCP context disposed');
        await this.closeBrowserContext();
        Context._allContexts.delete(this);
    }
    async _setupRequestInterception(context) {
        if (this.config.network?.allowedOrigins?.length) {
            await context.route('**', route => route.abort('blockedbyclient'));
            for (const origin of this.config.network.allowedOrigins)
                await context.route(`*://${origin}/**`, route => route.continue());
        }
        if (this.config.network?.blockedOrigins?.length) {
            for (const origin of this.config.network.blockedOrigins)
                await context.route(`*://${origin}/**`, route => route.abort('blockedbyclient'));
        }
    }
    _ensureBrowserContext() {
        if (!this._browserContextPromise) {
            this._browserContextPromise = this._setupBrowserContext();
            this._browserContextPromise.catch(() => {
                this._browserContextPromise = undefined;
            });
        }
        return this._browserContextPromise;
    }
    async _setupBrowserContext() {
        if (this._closeBrowserContextPromise)
            throw new Error('Another browser context is being closed.');
        // TODO: move to the browser context factory to make it based on isolation mode.
        const result = await this._browserContextFactory.createContext(this._clientInfo, this._abortController.signal);
        const { browserContext } = result;
        await this._setupRequestInterception(browserContext);
        if (this.sessionLog)
            await InputRecorder.create(this, browserContext);
        for (const page of browserContext.pages())
            this._onPageCreated(page);
        browserContext.on('page', page => this._onPageCreated(page));
        if (this.config.saveTrace) {
            await browserContext.tracing.start({
                name: 'trace',
                screenshots: false,
                snapshots: true,
                sources: false,
            });
        }
        return result;
    }
}
export class InputRecorder {
    _context;
    _browserContext;
    constructor(context, browserContext) {
        this._context = context;
        this._browserContext = browserContext;
    }
    static async create(context, browserContext) {
        const recorder = new InputRecorder(context, browserContext);
        await recorder._initialize();
        return recorder;
    }
    async _initialize() {
        const sessionLog = this._context.sessionLog;
        await this._browserContext._enableRecorder({
            mode: 'recording',
            recorderMode: 'api',
        }, {
            actionAdded: (page, data, code) => {
                if (this._context.isRunningTool())
                    return;
                const tab = Tab.forPage(page);
                if (tab)
                    sessionLog.logUserAction(data.action, tab, code, false);
            },
            actionUpdated: (page, data, code) => {
                if (this._context.isRunningTool())
                    return;
                const tab = Tab.forPage(page);
                if (tab)
                    sessionLog.logUserAction(data.action, tab, code, true);
            },
            signalAdded: (page, data) => {
                if (this._context.isRunningTool())
                    return;
                if (data.signal.name !== 'navigation')
                    return;
                const tab = Tab.forPage(page);
                const navigateAction = {
                    name: 'navigate',
                    url: data.signal.url,
                    signals: [],
                };
                if (tab)
                    sessionLog.logUserAction(navigateAction, tab, `await page.goto('${data.signal.url}');`, false);
            },
        });
    }
}
