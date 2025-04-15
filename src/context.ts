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

import * as playwright from 'playwright';
import yaml from 'yaml';

import { waitForCompletion } from './tools/utils';
import { ToolResult } from './tools/tool';

export type ContextOptions = {
  browserName?: 'chromium' | 'firefox' | 'webkit';
  userDataDir: string;
  launchOptions?: playwright.LaunchOptions;
  cdpEndpoint?: string;
  remoteEndpoint?: string;
};

type PageOrFrameLocator = playwright.Page | playwright.FrameLocator;

type RunOptions = {
  captureSnapshot?: boolean;
  waitForCompletion?: boolean;
  noClearFileChooser?: boolean;
};

export class Context {
  readonly options: ContextOptions;
  private _browser: playwright.Browser | undefined;
  private _browserContext: playwright.BrowserContext | undefined;
  private _tabs: Tab[] = [];
  private _currentTab: Tab | undefined;

  constructor(options: ContextOptions) {
    this.options = options;
  }

  tabs(): Tab[] {
    return this._tabs;
  }

  currentTab(): Tab {
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

  async listTabs(): Promise<string> {
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
    const tab = index === undefined ? this.currentTab() : this._tabs[index - 1];
    await tab.page.close();
    return await this.listTabs();
  }

  private _onPageCreated(page: playwright.Page) {
    const tab = new Tab(this, page, tab => this._onPageClosed(tab));
    this._tabs.push(tab);
    if (!this._currentTab)
      this._currentTab = tab;
  }

  private _onPageClosed(tab: Tab) {
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
    this._browserContext = undefined;
    this._browser = undefined;

    await browserContext?.close().then(async () => {
      await browser?.close();
    }).catch(() => {});
  }

  private async _ensureBrowserContext() {
    if (!this._browserContext) {
      const context = await this._createBrowserContext();
      this._browser = context.browser;
      this._browserContext = context.browserContext;
      for (const page of this._browserContext.pages())
        this._onPageCreated(page);
      this._browserContext.on('page', page => this._onPageCreated(page));
    }
    return this._browserContext;
  }

  private async _createBrowserContext(): Promise<{ browser?: playwright.Browser, browserContext: playwright.BrowserContext }> {
    if (this.options.remoteEndpoint) {
      const url = new URL(this.options.remoteEndpoint);
      if (this.options.browserName)
        url.searchParams.set('browser', this.options.browserName);
      if (this.options.launchOptions)
        url.searchParams.set('launch-options', JSON.stringify(this.options.launchOptions));
      const browser = await playwright[this.options.browserName ?? 'chromium'].connect(String(url));
      const browserContext = await browser.newContext();
      return { browser, browserContext };
    }

    if (this.options.cdpEndpoint) {
      const browser = await playwright.chromium.connectOverCDP(this.options.cdpEndpoint);
      const browserContext = browser.contexts()[0];
      return { browser, browserContext };
    }

    const browserContext = await this._launchPersistentContext();
    return { browserContext };
  }

  private async _launchPersistentContext(): Promise<playwright.BrowserContext> {
    try {
      const browserType = this.options.browserName ? playwright[this.options.browserName] : playwright.chromium;
      return await browserType.launchPersistentContext(this.options.userDataDir, this.options.launchOptions);
    } catch (error: any) {
      if (error.message.includes('Executable doesn\'t exist'))
        throw new Error(`Browser specified in your config is not installed. Either install it (likely) or change the config.`);
      throw error;
    }
  }
}

type RunResult = {
  code: string[];
};

class Tab {
  readonly context: Context;
  readonly page: playwright.Page;
  private _console: playwright.ConsoleMessage[] = [];
  private _fileChooser: playwright.FileChooser | undefined;
  private _snapshot: PageSnapshot | undefined;
  private _onPageClose: (tab: Tab) => void;

  constructor(context: Context, page: playwright.Page, onPageClose: (tab: Tab) => void) {
    this.context = context;
    this.page = page;
    this._onPageClose = onPageClose;
    page.on('console', event => this._console.push(event));
    page.on('framenavigated', frame => {
      if (!frame.parentFrame())
        this._console.length = 0;
    });
    page.on('close', () => this._onClose());
    page.on('filechooser', chooser => this._fileChooser = chooser);
    page.setDefaultNavigationTimeout(60000);
    page.setDefaultTimeout(5000);
  }

  private _onClose() {
    this._fileChooser = undefined;
    this._console.length = 0;
    this._onPageClose(this);
  }

  async navigate(url: string) {
    await this.page.goto(url, { waitUntil: 'domcontentloaded' });
    // Cap load event to 5 seconds, the page is operational at this point.
    await this.page.waitForLoadState('load', { timeout: 5000 }).catch(() => {});
  }

  async run(callback: (tab: Tab) => Promise<RunResult>, options?: RunOptions): Promise<ToolResult> {
    let runResult: RunResult | undefined;
    try {
      if (!options?.noClearFileChooser)
        this._fileChooser = undefined;
      if (options?.waitForCompletion)
        runResult = await waitForCompletion(this.page, () => callback(this)) ?? undefined;
      else
        runResult = await callback(this) ?? undefined;
    } finally {
      if (options?.captureSnapshot)
        this._snapshot = await PageSnapshot.create(this.page);
    }

    const result: string[] = [];
    result.push(`- Ran code:
\`\`\`js
${runResult.code.join('\n')}
\`\`\`
`);

    if (this.context.tabs().length > 1)
      result.push(await this.context.listTabs(), '');

    if (this._snapshot) {
      if (this.context.tabs().length > 1)
        result.push('### Current tab');
      result.push(this._snapshot.text({ hasFileChooser: !!this._fileChooser }));
    }

    return {
      content: [{
        type: 'text',
        text: result.join('\n'),
      }],
    };
  }

  async runAndWait(callback: (tab: Tab) => Promise<RunResult>, options?: RunOptions): Promise<ToolResult> {
    return await this.run(callback, {
      waitForCompletion: true,
      ...options,
    });
  }

  async runAndWaitWithSnapshot(callback: (snapshot: PageSnapshot) => Promise<RunResult>, options?: RunOptions): Promise<ToolResult> {
    return await this.run(tab => callback(tab.lastSnapshot()), {
      captureSnapshot: true,
      waitForCompletion: true,
      ...options,
    });
  }

  lastSnapshot(): PageSnapshot {
    if (!this._snapshot)
      throw new Error('No snapshot available');
    return this._snapshot;
  }

  async console(): Promise<playwright.ConsoleMessage[]> {
    return this._console;
  }

  async submitFileChooser(paths: string[]) {
    if (!this._fileChooser)
      throw new Error('No file chooser visible');
    await this._fileChooser.setFiles(paths);
    this._fileChooser = undefined;
  }
}

class PageSnapshot {
  private _frameLocators: PageOrFrameLocator[] = [];
  private _text!: string;

  constructor() {
  }

  static async create(page: playwright.Page): Promise<PageSnapshot> {
    const snapshot = new PageSnapshot();
    await snapshot._build(page);
    return snapshot;
  }

  text(options: { hasFileChooser: boolean }): string {
    const results: string[] = [];
    if (options.hasFileChooser) {
      results.push('- There is a file chooser visible that requires browser_file_upload to be called');
      results.push('');
    }
    results.push(this._text);
    return results.join('\n');
  }

  private async _build(page: playwright.Page) {
    const yamlDocument = await this._snapshotFrame(page);
    const lines = [];
    lines.push(
        `- Page URL: ${page.url()}`,
        `- Page Title: ${await page.title()}`
    );
    lines.push(
        `- Page Snapshot`,
        '```yaml',
        yamlDocument.toString().trim(),
        '```',
        ''
    );
    this._text = lines.join('\n');
  }

  private async _snapshotFrame(frame: playwright.Page | playwright.FrameLocator) {
    const frameIndex = this._frameLocators.push(frame) - 1;
    const snapshotString = await frame.locator('body').ariaSnapshot({ ref: true });
    const snapshot = yaml.parseDocument(snapshotString);

    const visit = async (node: any): Promise<unknown> => {
      if (yaml.isPair(node)) {
        await Promise.all([
          visit(node.key).then(k => node.key = k),
          visit(node.value).then(v => node.value = v)
        ]);
      } else if (yaml.isSeq(node) || yaml.isMap(node)) {
        node.items = await Promise.all(node.items.map(visit));
      } else if (yaml.isScalar(node)) {
        if (typeof node.value === 'string') {
          const value = node.value;
          if (frameIndex > 0)
            node.value = value.replace('[ref=', `[ref=f${frameIndex}`);
          if (value.startsWith('iframe ')) {
            const ref = value.match(/\[ref=(.*)\]/)?.[1];
            if (ref) {
              try {
                const childSnapshot = await this._snapshotFrame(frame.frameLocator(`aria-ref=${ref}`));
                return snapshot.createPair(node.value, childSnapshot);
              } catch (error) {
                return snapshot.createPair(node.value, '<could not take iframe snapshot>');
              }
            }
          }
        }
      }

      return node;
    };
    await visit(snapshot.contents);
    return snapshot;
  }

  refLocator(ref: string): playwright.Locator {
    let frame = this._frameLocators[0];
    const match = ref.match(/^f(\d+)(.*)/);
    if (match) {
      const frameIndex = parseInt(match[1], 10);
      frame = this._frameLocators[frameIndex];
      ref = match[2];
    }

    if (!frame)
      throw new Error(`Frame does not exist. Provide ref from the most current snapshot.`);

    return frame.locator(`aria-ref=${ref}`);
  }
}

export async function generateLocator(locator: playwright.Locator): Promise<string> {
  return (locator as any)._generateLocatorString();
}
