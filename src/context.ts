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

import { Tab } from './tab.js';

import { popupAnalysis } from './detect-popups.js';
import type { Tool } from './tools/tool.js';
import type { FullConfig } from './config.js';
import type { BrowserContextFactory } from './browserContextFactory.js';

const testDebug = debug('pw:mcp:test');

export class Context {
  readonly tools: Tool[];
  readonly config: FullConfig;
  private _browserContextPromise:
    | Promise<{
        browserContext: playwright.BrowserContext;
        close: () => Promise<void>;
      }>
    | undefined;
  private _browserContextFactory: BrowserContextFactory;
  private _tabs: Tab[] = [];
  private _currentTab: Tab | undefined;
  clientVersion: { name: string; version: string; } | undefined;

  constructor(
    tools: Tool[],
    config: FullConfig,
    browserContextFactory: BrowserContextFactory
  ) {
    this.tools = tools;
    this.config = config;
    this._browserContextFactory = browserContextFactory;
    testDebug('create context');
  }

  tabs(): Tab[] {
    return this._tabs;
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
    this._currentTab = this._tabs[index];
    await this._currentTab.page.bringToFront();
  }

  async ensureTab(): Promise<Tab> {
    const { browserContext } = await this._ensureBrowserContext();
    if (!this._currentTab)
      await browserContext.newPage();
    return this._currentTab!;
  }

  async listTabsMarkdown(): Promise<string[]> {
    if (!this._tabs.length)
      return ['### No tabs open'];
    const lines: string[] = ['### Open tabs'];
    for (let i = 0; i < this._tabs.length; i++) {
      const tab = this._tabs[i];
      const title = await tab.title();
      const url = tab.page.url();
      const current = tab === this._currentTab ? ' (current)' : '';
      lines.push(`- ${i}:${current} [${title}] (${url})`);
    }
    return lines;
  }

  async closeTab(index: number | undefined) {
    const tab = index === undefined ? this._currentTab : this._tabs[index];
    await tab?.page.close();
    return await this.listTabsMarkdown();
  }

  async run(tool: Tool, params: Record<string, unknown> | undefined) {
    // Tab management is done outside of the action() call.
    const toolResult = await tool.handle(this, tool.schema.inputSchema.parse(params || {}));
    const { code, action, waitForNetwork, captureSnapshot, resultOverride } = toolResult;

    if (resultOverride)
      return resultOverride;

    const tab = this.currentTabOrDie();
    const { actionResult, snapshot } = await tab.run(action || (() => Promise.resolve()), { waitForNetwork, captureSnapshot });

    const result: string[] = [];
    result.push(`### Ran Playwright code
\`\`\`js
${code.join('\n')}
\`\`\``);

    if (tab.modalStates().length) {
      result.push('', ...tab.modalStatesMarkdown());
      return {
        content: [
          {
            type: 'text',
            text: result.join('\n'),
          },
        ],
      };
    }

    result.push(...tab.takeRecentConsoleMarkdown());
    result.push(...tab.listDownloadsMarkdown());

    if (snapshot) {
      if (this.tabs().length > 1)
        result.push('', ...(await this.listTabsMarkdown()));
      result.push('', snapshot);
    }

    const content = actionResult?.content ?? [];

    return {
      content: [
        ...content,
        {
          type: 'text',
          text: result.join('\n'),
        },
      ],
    };
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
    if (!this._tabs.length) {
      // console.log('No tabs left, closing context');

      // Note that its likely here that the context is already dead :(
      // so we wrap this in a try catch
      this.close().catch(error => {
        // console.error('Error closing context:', error);
      });
    }
  }

  async close() {
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

  private async _setupBrowserContext(): Promise<{
    browserContext: playwright.BrowserContext;
    close: () => Promise<void>;
  }> {
    // TODO: move to the browser context factory to make it based on isolation mode.
    const result = await this._browserContextFactory.createContext(this.clientVersion!);
    const { browserContext } = result;
    await this._setupRequestInterception(browserContext);

    // Handle initial pages that exist when the context is created
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
