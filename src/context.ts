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

import { waitForCompletion } from './tools/utils.js';
import { ManualPromise } from './manualPromise.js';
import { Tab } from './tab.js';

import type { ImageContent, TextContent } from '@modelcontextprotocol/sdk/types.js';
import type { ModalState, Tool, ToolActionResult } from './tools/tool.js';
import type { Config } from '../config.js';
import { outputFile } from './config.js';

type PendingAction = {
  dialogShown: ManualPromise<void>;
};

export class Context {
  readonly tools: Tool[];
  readonly config: Config;
  private _browser: playwright.Browser | undefined;
  private _browserContext: playwright.BrowserContext | undefined;
  private _createBrowserContextPromise: Promise<{ browser?: playwright.Browser, browserContext: playwright.BrowserContext }> | undefined;
  private _tabs: Tab[] = [];
  private _currentTab: Tab | undefined;
  private _modalStates: (ModalState & { tab: Tab })[] = [];
  private _pendingAction: PendingAction | undefined;
  private _downloads: { download: playwright.Download, finished: boolean, outputFile: string }[] = [];

  constructor(tools: Tool[], config: Config) {
    this.tools = tools;
    this.config = config;
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
    const browserContext = await this._ensureBrowserContext();
    const page = await browserContext.newPage();
    this._currentTab = this._tabs.find(t => t.page === page)!;
    return this._currentTab;
  }

  async selectTab(index: number) {
    this._currentTab = this._tabs[index - 1];
    await this._currentTab.page.bringToFront();
  }

  async ensureTab(): Promise<Tab> {
    const context = await this._ensureBrowserContext();
    if (!this._currentTab)
      await context.newPage();
    return this._currentTab!;
  }

  async listTabsMarkdown(): Promise<string> {
    if (!this._tabs.length)
      return '### No tabs open';
    const lines: string[] = ['### Open tabs'];
    for (let i = 0; i < this._tabs.length; i++) {
      const tab = this._tabs[i];
      const title = await tab.page.title();
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
    const toolResult = await tool.handle(this, tool.schema.inputSchema.parse(params));
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
    try {
      if (waitForNetwork)
        actionResult = await waitForCompletion(this, tab.page, async () => racingAction?.()) ?? undefined;
      else
        actionResult = await racingAction?.() ?? undefined;
    } finally {
      if (captureSnapshot && !this._javaScriptBlocked())
        await tab.captureSnapshot();
    }

    const result: string[] = [];
    result.push(`- Ran Playwright code:
\`\`\`js
${code.join('\n')}
\`\`\`
`);

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

    result.push(
        `- Page URL: ${tab.page.url()}`,
        `- Page Title: ${await tab.page.title()}`
    );

    if (captureSnapshot && tab.hasSnapshot())
      result.push(tab.snapshotOrDie().text());

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
    if (this._currentTab && !this._javaScriptBlocked())
      await this._currentTab.page.evaluate(() => new Promise(f => setTimeout(f, 1000)));
    else
      await new Promise(f => setTimeout(f, time));
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
    if (this._browserContext && !this._tabs.length)
      void this.close();
  }

  async close() {
    if (!this._browserContext)
      return;
    const browserContext = this._browserContext;
    const browser = this._browser;
    this._createBrowserContextPromise = undefined;
    this._browserContext = undefined;
    this._browser = undefined;

    await browserContext?.close().then(async () => {
      await browser?.close();
    }).catch(() => {});
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

  private async _ensureBrowserContext() {
    if (!this._browserContext) {
      const context = await this._createBrowserContext();
      this._browser = context.browser;
      this._browserContext = context.browserContext;
      await this._setupRequestInterception(this._browserContext);
      for (const page of this._browserContext.pages())
        this._onPageCreated(page);
      this._browserContext.on('page', page => this._onPageCreated(page));
    }
    return this._browserContext;
  }

  private async _createBrowserContext(): Promise<{ browser?: playwright.Browser, browserContext: playwright.BrowserContext }> {
    if (!this._createBrowserContextPromise) {
      this._createBrowserContextPromise = this._innerCreateBrowserContext();
      void this._createBrowserContextPromise.catch(() => {
        this._createBrowserContextPromise = undefined;
      });
    }
    return this._createBrowserContextPromise;
  }

  private async _innerCreateBrowserContext(): Promise<{ browser?: playwright.Browser, browserContext: playwright.BrowserContext }> {
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
      const browserContext = browser.contexts()[0];
      return { browser, browserContext };
    }

    const browserContext = await launchPersistentContext(this.config.browser);
    return { browserContext };
  }
}

async function launchPersistentContext(browserConfig: Config['browser']): Promise<playwright.BrowserContext> {
  try {
    const browserName = browserConfig?.browserName ?? 'chromium';
    const userDataDir = browserConfig?.userDataDir ?? await createUserDataDir({ ...browserConfig, browserName });
    const browserType = playwright[browserName];
    return await browserType.launchPersistentContext(userDataDir, { ...browserConfig?.launchOptions, ...browserConfig?.contextOptions });
  } catch (error: any) {
    if (error.message.includes('Executable doesn\'t exist'))
      throw new Error(`Browser specified in your config is not installed. Either install it (likely) or change the config.`);
    throw error;
  }
}

async function createUserDataDir(browserConfig: Config['browser']) {
  let cacheDirectory: string;
  if (process.platform === 'linux')
    cacheDirectory = process.env.XDG_CACHE_HOME || path.join(os.homedir(), '.cache');
  else if (process.platform === 'darwin')
    cacheDirectory = path.join(os.homedir(), 'Library', 'Caches');
  else if (process.platform === 'win32')
    cacheDirectory = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
  else
    throw new Error('Unsupported platform: ' + process.platform);
  const result = path.join(cacheDirectory, 'ms-playwright', `mcp-${browserConfig?.launchOptions?.channel ?? browserConfig?.browserName}-profile`);
  await fs.promises.mkdir(result, { recursive: true });
  return result;
}

export async function generateLocator(locator: playwright.Locator): Promise<string> {
  return (locator as any)._generateLocatorString();
}

const __filename = url.fileURLToPath(import.meta.url);
export const packageJSON = JSON.parse(fs.readFileSync(path.join(path.dirname(__filename), '..', 'package.json'), 'utf8'));
