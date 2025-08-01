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
import * as playwright from 'playwright';

import { logUnhandledError } from './log.js';
import { Tab } from './tab.js';
import { outputFile  } from './config.js';

import { popupAnalysis } from './detect-popups.js';
import type { FullConfig } from './config.js';
import type { Tool } from './tools/tool.js';
import type { BrowserContextFactory, ClientInfo } from './browserContextFactory.js';
import type * as actions from './actions.js';
import type { SessionLog } from './sessionLog.js';

const testDebug = debug('pw:mcp:test');

type ContextOptions = {
  tools: Tool[];
  config: FullConfig;
  browserContextFactory: BrowserContextFactory;
  sessionLog: SessionLog | undefined;
  clientInfo: ClientInfo;
};

export class Context {
  readonly tools: Tool[];
  readonly config: FullConfig;
  readonly sessionLog: SessionLog | undefined;
  private _browserContextPromise: Promise<{ browserContext: playwright.BrowserContext, close: () => Promise<void> }> | undefined;
  private _browserContextFactory: BrowserContextFactory;
  private _tabs: Tab[] = [];
  private _currentTab: Tab | undefined;
  private _clientInfo: ClientInfo;

  private static _allContexts: Set<Context> = new Set();
  private _closeBrowserContextPromise: Promise<void> | undefined;
  private _isRunningTool: boolean = false;
  private _abortController = new AbortController();

  constructor(options: ContextOptions) {
    this.tools = options.tools;
    this.config = options.config;
    this.sessionLog = options.sessionLog;
    this._browserContextFactory = options.browserContextFactory;
    this._clientInfo = options.clientInfo;
    testDebug('create context');
    Context._allContexts.add(this);
  }

  static async disposeAll() {
    await Promise.all([...Context._allContexts].map(context => context.dispose()));
  }

  tabs(): Tab[] {
    return this._tabs;
  }

  currentTab(): Tab | undefined {
    return this._currentTab;
  }

  currentTabOrDie(): Tab {
    if (!this._currentTab)
      throw new Error('No open pages available. Use the "browser_navigate" tool to navigate to a page first.');
    return this._currentTab;
  }

  async newTab(): Promise<Tab> {
    const { browserContext } = await this._ensureBrowserContext();
    const page = await browserContext.newPage();
    this._currentTab = this._tabs.find(t => t.page === page)!;
    return this._currentTab;
  }

  async selectTab(index: number) {
    const tab = this._tabs[index];
    if (!tab)
      throw new Error(`Tab ${index} not found`);
    await tab.page.bringToFront();
    this._currentTab = tab;
    return tab;
  }

  async ensureTab(): Promise<Tab> {
    const { browserContext } = await this._ensureBrowserContext();
    if (!this._currentTab)
      await browserContext.newPage();
    return this._currentTab!;
  }

  async closeTab(index: number | undefined): Promise<string> {
    const tab = index === undefined ? this._currentTab : this._tabs[index];
    if (!tab)
      throw new Error(`Tab ${index} not found`);
    const url = tab.page.url();
    await tab.page.close();
    return url;
  }

  async outputFile(name: string): Promise<string> {
    return outputFile(this.config, this._clientInfo.rootPath, name);
  }

  private async _onPageCreated(page: playwright.Page) {
    // console.log('Page created, checking for popup');

    try {
      const isPopup = await this._handlePopup(page);
      // If it was a popup, we don't want to add it to the tabs list
      if (isPopup)
        return;
    } catch (error) {
      // console.error('Error handling popup:', error);
      // Continue with normal page creation even if popup handling fails
    }

    const tab = new Tab(this, page, tab => this._onPageClosed(tab));
    this._tabs.push(tab);
    // Always switch to the new tab
    this._currentTab = tab;
  }

  /**
   * Handles popup windows by converting them to tabs
   * Only converts popup windows, not new tabs
   */
  private async _handlePopup(popupPage: playwright.Page): Promise<boolean> {
    try {
      // Wait to ensure that the `context.on("page")` event has fired
      await new Promise(resolve => setTimeout(resolve, 200));

      // Check if this is actually a popup window (not just a new tab)
      const isPopupWindow = await this._isPopupWindow(popupPage);
      if (!isPopupWindow) {
        // console.log('Not a popup window');
        // If it's not a popup window, we don't need to do anything, since
        // the context.on("page") event will handle it.
        return false;
      }

      // console.log('Is a popup window, getting URL');

      await popupPage.waitForLoadState('domcontentloaded');

      // Some popups take a while to fully resolve a URL
      await new Promise(resolve => setTimeout(resolve, 4000));

      let popupUrl: string | undefined;
      let attempts = 0;

      while (!popupUrl && attempts < 3) {
        try {
          popupUrl = popupPage.url();

          if (popupUrl === 'about:blank')
            popupUrl = undefined;

        } catch (error) {
          // console.log('Failed to get popup URL, retrying');
        }

        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;
      }

      if (!popupUrl) {
        // console.log('Failed to get popup URL, closing popup');
        await popupPage.close();
        return true;
      }

      // Only convert if we have a valid URL
      if (
        !popupUrl ||
        popupUrl === 'about:blank' ||
        popupUrl.startsWith('data:')
      ) {
        // For data URLs or blank pages, just close the popup
        await popupPage.close();
        return true;
      }

      // Create a new page directly and navigate to the popup URL
      const { browserContext } = await this._ensureBrowserContext();
      const newPage = await browserContext.newPage();

      try {
        await newPage.goto(popupUrl, {
          waitUntil: 'domcontentloaded',
          timeout: 10000,
        });
      } catch (navigationError) {
        // If navigation fails, just close the popup and keep the new page
        // The new page will remain open but empty, which is better than losing it
        // console.warn('Navigation to popup URL failed:', navigationError);
      }

      // Close the popup
      await popupPage.close();
    } catch (error) {
      // If conversion fails, just close the popup
      try {
        await popupPage.close();
      } catch (closeError) {
        // Ignore close errors
        // console.warn('Error closing popup:', closeError);
      }
    }

    return true;
  }

  /**
   * Checks if a page is a popup window (not just a new tab)
   */
  private async _isPopupWindow(page: playwright.Page): Promise<boolean> {
    try {
      // Wait for the page to be ready, but with a timeout
      await page.waitForLoadState('domcontentloaded', { timeout: 5000 });

      // Use a timeout for the popup analysis to prevent hanging
      const analysis = await Promise.race([
        popupAnalysis(page),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Popup analysis timeout')), 3000)
        ),
      ]);

      // console.log('Popup analysis:', analysis);

      if (analysis.isPopup) {
        // console.log(`Popup detected with ${analysis.confidence}% confidence`);
        // console.log('Reasons:', analysis.reasons);
      }

      return analysis.isPopup;
    } catch (error) {
      // Check if it's a navigation-related error
      // const errorMessage =
      //   error instanceof Error ? error.message : String(error);

      // console.error('Error checking if page is a popup window:', errorMessage);
      // If we can't determine, assume it's not a popup window
      return false;
    }
  }

  private _onPageClosed(tab: Tab) {
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

  setRunningTool(isRunningTool: boolean) {
    this._isRunningTool = isRunningTool;
  }

  private async _closeBrowserContextImpl() {
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

  private async _setupRequestInterception(context: playwright.BrowserContext) {
    if (this.config.network?.allowedOrigins?.length) {
      await context.route('**', route => route.abort('blockedbyclient'));

      for (const origin of this.config.network.allowedOrigins)
        await context.route(`*://${origin}/**`, route => route.continue());
    }

    if (this.config.network?.blockedOrigins?.length) {
      for (const origin of this.config.network.blockedOrigins) {
        await context.route(`*://${origin}/**`, route =>
          route.abort('blockedbyclient')
        );
      }
    }
  }

  private _ensureBrowserContext() {
    if (!this._browserContextPromise) {
      this._browserContextPromise = this._setupBrowserContext();
      this._browserContextPromise.catch(() => {
        this._browserContextPromise = undefined;
      });
    }
    return this._browserContextPromise;
  }

  private async _setupBrowserContext(): Promise<{ browserContext: playwright.BrowserContext, close: () => Promise<void> }> {
    if (this._closeBrowserContextPromise)
      throw new Error('Another browser context is being closed.');
    // TODO: move to the browser context factory to make it based on isolation mode.
    const result = await this._browserContextFactory.createContext(this._clientInfo, this._abortController.signal);
    const { browserContext } = result;
    await this._setupRequestInterception(browserContext);
    if (this.sessionLog)
      await InputRecorder.create(this, browserContext);
    for (const page of browserContext.pages())
      await this._onPageCreated(page);


    browserContext.on('page', async page => {
      // All new pages should be handled normally
      await this._onPageCreated(page);
    });
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
  private _context: Context;
  private _browserContext: playwright.BrowserContext;

  private constructor(context: Context, browserContext: playwright.BrowserContext) {
    this._context = context;
    this._browserContext = browserContext;
  }

  static async create(context: Context, browserContext: playwright.BrowserContext) {
    const recorder = new InputRecorder(context, browserContext);
    await recorder._initialize();
    return recorder;
  }

  private async _initialize() {
    const sessionLog = this._context.sessionLog!;
    await (this._browserContext as any)._enableRecorder({
      mode: 'recording',
      recorderMode: 'api',
    }, {
      actionAdded: (page: playwright.Page, data: actions.ActionInContext, code: string) => {
        if (this._context.isRunningTool())
          return;
        const tab = Tab.forPage(page);
        if (tab)
          sessionLog.logUserAction(data.action, tab, code, false);
      },
      actionUpdated: (page: playwright.Page, data: actions.ActionInContext, code: string) => {
        if (this._context.isRunningTool())
          return;
        const tab = Tab.forPage(page);
        if (tab)
          sessionLog.logUserAction(data.action, tab, code, true);
      },
      signalAdded: (page: playwright.Page, data: actions.SignalInContext) => {
        if (this._context.isRunningTool())
          return;
        if (data.signal.name !== 'navigation')
          return;
        const tab = Tab.forPage(page);
        const navigateAction: actions.Action = {
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
