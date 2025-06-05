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
import url from 'node:url';
import os from 'node:os';
import path from 'node:path';

import * as playwright from 'playwright';

import { callOnPageNoTrace, waitForCompletion } from './tools/utils.js';
import { ManualPromise } from './manualPromise.js';
import { Tab } from './tab.js';
import { outputFile } from './config.js';

import type { ImageContent, TextContent } from '@modelcontextprotocol/sdk/types.js';
import type { ModalState, Tool, ToolActionResult } from './tools/tool.js';
import type { FullConfig } from './config.js';

type PendingAction = {
  dialogShown: ManualPromise<void>;
};

type BrowserContextAndBrowser = {
  browser?: playwright.Browser;
  browserContext: playwright.BrowserContext;
};

export class Context {
  readonly tools: Tool[];
  readonly config: FullConfig;
  private _browserContextPromise: Promise<BrowserContextAndBrowser> | undefined;
  private _tabs: Tab[] = [];
  private _currentTab: Tab | undefined;
  private _modalStates: (ModalState & { tab: Tab })[] = [];
  private _pendingAction: PendingAction | undefined;
  private _downloads: { download: playwright.Download, finished: boolean, outputFile: string }[] = [];
  clientVersion: { name: string; version: string; } | undefined;

  constructor(tools: Tool[], config: FullConfig) {
    this.tools = tools;
    this.config = config;
  }

  clientSupportsImages(): boolean {
    if (this.config.imageResponses === 'allow')
      return true;
    if (this.config.imageResponses === 'omit')
      return false;
    return !this.clientVersion?.name.includes('cursor');
  }

  modalStates(): ModalState[] {
    return this._modalStates;
  }

  setModalState(modalState: ModalState, inTab: Tab) {
    this._modalStates.push({ ...modalState, tab: inTab });
  }

  clearModalState(modalState: ModalState) {
    this._modalStates = this._modalStates.filter(state => state !== modalState);
  }

  modalStatesMarkdown(): string[] {
    const result: string[] = ['### Modal state'];
    if (this._modalStates.length === 0)
      result.push('- There is no modal state present');
    for (const state of this._modalStates) {
      const tool = this.tools.find(tool => tool.clearsModalState === state.type);
      result.push(`- [${state.description}]: can be handled by the "${tool?.schema.name}" tool`);
    }
    return result;
  }

  tabs(): Tab[] {
    return this._tabs;
  }

  currentTabOrDie(): Tab {
    if (!this._currentTab)
      throw new Error('No current snapshot available. Capture a snapshot of navigate to a new location first.');
    return this._currentTab;
  }

  async newTab(): Promise<Tab> {
    const { browserContext } = await this._ensureBrowserContext();
    const page = await browserContext.newPage();
    this._currentTab = this._tabs.find(t => t.page === page)!;
    return this._currentTab;
  }

  async selectTab(index: number) {
    this._currentTab = this._tabs[index - 1];
    await this._currentTab.page.bringToFront();
  }

  async ensureTab(): Promise<Tab> {
    const { browserContext } = await this._ensureBrowserContext();
    if (!this._currentTab)
      await browserContext.newPage();
    return this._currentTab!;
  }

  async listTabsMarkdown(): Promise<string> {
    if (!this._tabs.length)
      return '### No tabs open';
    const lines: string[] = ['### Open tabs'];
    for (let i = 0; i < this._tabs.length; i++) {
      const tab = this._tabs[i];
      const title = await tab.title();
      const url = tab.page.url();
      const current = tab === this._currentTab ? ' (current)' : '';
      lines.push(`- ${i + 1}:${current} [${title}] (${url})`);
    }
    return lines.join('\n');
  }

  async closeTab(index: number | undefined) {
    const tab = index === undefined ? this._currentTab : this._tabs[index - 1];
    await tab?.page.close();
    return await this.listTabsMarkdown();
  }

  async run(tool: Tool, params: Record<string, unknown> | undefined) {
    // Tab management is done outside of the action() call.
    const toolResult = await tool.handle(this, tool.schema.inputSchema.parse(params || {}));
    const { code, action, waitForNetwork, captureSnapshot, resultOverride } = toolResult;
    const racingAction = action ? () => this._raceAgainstModalDialogs(action) : undefined;

    if (resultOverride)
      return resultOverride;

    if (!this._currentTab) {
      return {
        content: [{
          type: 'text',
          text: 'No open pages available. Use the "browser_navigate" tool to navigate to a page first.',
        }],
      };
    }

    const tab = this.currentTabOrDie();
    // TODO: race against modal dialogs to resolve clicks.
    let actionResult: { content?: (ImageContent | TextContent)[] } | undefined;
    let actionError: Error | undefined;
    
    try {
      // Add timeout wrapper and better error handling for browser interactions
      const actionWithTimeout = async () => {
        if (!racingAction) return undefined;
        
        // Set a reasonable timeout for browser actions (30 seconds)
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Browser action timed out after 30 seconds')), 30000);
        });
        
        return await Promise.race([racingAction(), timeoutPromise]);
      };

      if (waitForNetwork)
        actionResult = await waitForCompletion(this, tab, actionWithTimeout) ?? undefined;
      else
        actionResult = await actionWithTimeout() ?? undefined;
    } catch (error: any) {
      actionError = error;
      
      // Check if the browser context is still alive
      try {
        await tab.page.evaluate(() => true);
      } catch (pageError: any) {
        // Mark this tab as problematic but don't crash the server
        actionError = new Error(`Browser became unresponsive during action: ${error.message}`);
      }
    } finally {
      // Only try to capture snapshot if we have a responsive browser
      if (captureSnapshot && !this._javaScriptBlocked() && !actionError) {
        try {
          await tab.captureSnapshot();
        } catch (snapshotError: any) {
          // Don't fail the entire operation just because snapshot failed
          // In stdio mode, we can't log errors to console
        }
      }
    }

    const result: string[] = [];
    result.push(`- Ran Playwright code:
\`\`\`js
${code.join('\n')}
\`\`\`
`);

    // Add error information if action failed
    if (actionError) {
      result.push(`
⚠️ **Action Failed**: ${actionError.message}

The browser action encountered an error but the MCP server recovered gracefully.`);
    }

    if (this.modalStates().length) {
      result.push(...this.modalStatesMarkdown());
      return {
        content: [{
          type: 'text',
          text: result.join('\n'),
        }],
      };
    }

    if (this._downloads.length) {
      result.push('', '### Downloads');
      for (const entry of this._downloads) {
        if (entry.finished)
          result.push(`- Downloaded file ${entry.download.suggestedFilename()} to ${entry.outputFile}`);
        else
          result.push(`- Downloading file ${entry.download.suggestedFilename()} ...`);
      }
      result.push('');
    }

    if (this.tabs().length > 1)
      result.push(await this.listTabsMarkdown(), '');

    if (this.tabs().length > 1)
      result.push('### Current tab');

    // Safely get page information, handling potential browser disconnection
    try {
      result.push(
          `- Page URL: ${tab.page.url()}`,
          `- Page Title: ${await tab.title()}`
      );
    } catch (error: any) {
      result.push(`- Page information unavailable (browser may be disconnected): ${error.message}`);
    }

    if (captureSnapshot && tab.hasSnapshot() && !actionError) {
      try {
        result.push(tab.snapshotOrDie().text());
      } catch (error: any) {
        result.push(`- Snapshot unavailable: ${error.message}`);
      }
    }

    const content = actionResult?.content ?? [];

    return {
      content: [
        ...content,
        {
          type: 'text',
          text: result.join('\n'),
        }
      ],
    };
  }

  async waitForTimeout(time: number) {
    if (!this._currentTab || this._javaScriptBlocked()) {
      await new Promise(f => setTimeout(f, time));
      return;
    }

    await callOnPageNoTrace(this._currentTab.page, page => {
      return page.evaluate(() => new Promise(f => setTimeout(f, 1000)));
    });
  }

  private async _raceAgainstModalDialogs(action: () => Promise<ToolActionResult>): Promise<ToolActionResult> {
    this._pendingAction = {
      dialogShown: new ManualPromise(),
    };

    let result: ToolActionResult | undefined;
    try {
      await Promise.race([
        action().then(r => result = r),
        this._pendingAction.dialogShown,
      ]);
    } finally {
      this._pendingAction = undefined;
    }
    return result;
  }

  private _javaScriptBlocked(): boolean {
    return this._modalStates.some(state => state.type === 'dialog');
  }

  dialogShown(tab: Tab, dialog: playwright.Dialog) {
    this.setModalState({
      type: 'dialog',
      description: `"${dialog.type()}" dialog with message "${dialog.message()}"`,
      dialog,
    }, tab);
    this._pendingAction?.dialogShown.resolve();
  }

  async downloadStarted(tab: Tab, download: playwright.Download) {
    const entry = {
      download,
      finished: false,
      outputFile: await outputFile(this.config, download.suggestedFilename())
    };
    this._downloads.push(entry);
    await download.saveAs(entry.outputFile);
    entry.finished = true;
  }

  private _onPageCreated(page: playwright.Page) {
    const tab = new Tab(this, page, tab => this._onPageClosed(tab));
    this._tabs.push(tab);
    if (!this._currentTab)
      this._currentTab = tab;
  }

  private _onPageClosed(tab: Tab) {
    this._modalStates = this._modalStates.filter(state => state.tab !== tab);
    const index = this._tabs.indexOf(tab);
    if (index === -1)
      return;
    this._tabs.splice(index, 1);

    if (this._currentTab === tab)
      this._currentTab = this._tabs[Math.min(index, this._tabs.length - 1)];
    if (!this._tabs.length)
      void this.close();
  }

  async close() {
    if (!this._browserContextPromise)
      return;

    const promise = this._browserContextPromise;
    this._browserContextPromise = undefined;

    await promise.then(async ({ browserContext, browser }) => {
      if (this.config.saveTrace)
        await browserContext.tracing.stop();
      await browserContext.close().then(async () => {
        await browser?.close();
      }).catch(() => {});
    });
  }

  private async _setupRequestInterception(context: playwright.BrowserContext) {
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

  private _ensureBrowserContext() {
    if (!this._browserContextPromise) {
      this._browserContextPromise = this._setupBrowserContext();
      this._browserContextPromise.catch(() => {
        this._browserContextPromise = undefined;
      });
    }
    return this._browserContextPromise;
  }

  private async _setupBrowserContext(): Promise<BrowserContextAndBrowser> {
    const { browser, browserContext } = await this._createBrowserContext();
    await this._setupRequestInterception(browserContext);
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
    return { browser, browserContext };
  }

  private async _createBrowserContext(): Promise<BrowserContextAndBrowser> {
    if (this.config.browser?.remoteEndpoint) {
      const url = new URL(this.config.browser?.remoteEndpoint);
      if (this.config.browser.browserName)
        url.searchParams.set('browser', this.config.browser.browserName);
      if (this.config.browser.launchOptions)
        url.searchParams.set('launch-options', JSON.stringify(this.config.browser.launchOptions));
      const browser = await playwright[this.config.browser?.browserName ?? 'chromium'].connect(String(url));
      const browserContext = await browser.newContext();
      return { browser, browserContext };
    }

    if (this.config.browser?.cdpEndpoint) {
      const browser = await playwright.chromium.connectOverCDP(this.config.browser.cdpEndpoint);
      const browserContext = this.config.browser.isolated ? await browser.newContext() : browser.contexts()[0];
      return { browser, browserContext };
    }

    return this.config.browser?.isolated ?
      await createIsolatedContext(this.config.browser) :
      await launchPersistentContext(this.config.browser);
  }
}

async function createIsolatedContext(browserConfig: FullConfig['browser']): Promise<BrowserContextAndBrowser> {
  try {
    const browserName = browserConfig?.browserName ?? 'chromium';
    const browserType = playwright[browserName];
    const browser = await browserType.launch(browserConfig.launchOptions);
    const browserContext = await browser.newContext(browserConfig.contextOptions);
    return { browser, browserContext };
  } catch (error: any) {
    if (error.message.includes('Executable doesn\'t exist'))
      throw new Error(`Browser specified in your config is not installed. Either install it (likely) or change the config.`);
    throw error;
  }
}

async function launchPersistentContext(browserConfig: FullConfig['browser']): Promise<BrowserContextAndBrowser> {
  try {
    const browserName = browserConfig.browserName ?? 'chromium';
    const userDataDir = browserConfig.userDataDir ?? await createUserDataDir({ ...browserConfig, browserName });
    const browserType = playwright[browserName];
    const browserContext = await browserType.launchPersistentContext(userDataDir, { ...browserConfig.launchOptions, ...browserConfig.contextOptions });
    return { browserContext };
  } catch (error: any) {
    if (error.message.includes('Executable doesn\'t exist'))
      throw new Error(`Browser specified in your config is not installed. Either install it (likely) or change the config.`);
    throw error;
  }
}

async function createUserDataDir(browserConfig: FullConfig['browser']) {
  let cacheDirectory: string;
  if (process.platform === 'linux')
    cacheDirectory = process.env.XDG_CACHE_HOME || path.join(os.homedir(), '.cache');
  else if (process.platform === 'darwin')
    cacheDirectory = path.join(os.homedir(), 'Library', 'Caches');
  else if (process.platform === 'win32')
    cacheDirectory = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
  else
    throw new Error('Unsupported platform: ' + process.platform);
  const result = path.join(cacheDirectory, 'ms-playwright', `mcp-${browserConfig.launchOptions?.channel ?? browserConfig?.browserName}-profile`);
  await fs.promises.mkdir(result, { recursive: true });
  return result;
}

const __filename = url.fileURLToPath(import.meta.url);
export const packageJSON = JSON.parse(fs.readFileSync(path.join(path.dirname(__filename), '..', 'package.json'), 'utf8'));
