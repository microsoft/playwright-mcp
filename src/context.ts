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

import { fork } from 'child_process';
import path from 'path';

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
  status?: string;
  noClearFileChooser?: boolean;
};

export class Context {
  private _options: ContextOptions;
  private _browser: playwright.Browser | undefined;
  private _page: playwright.Page | undefined;
  private _console: playwright.ConsoleMessage[] = [];
  private _createPagePromise: Promise<playwright.Page> | undefined;
  private _fileChooser: playwright.FileChooser | undefined;
  private _snapshot: PageSnapshot | undefined;

  constructor(options: ContextOptions) {
    this._options = options;
  }

  async createPage(): Promise<playwright.Page> {
    if (this._createPagePromise)
      return this._createPagePromise;
    this._createPagePromise = (async () => {
      const { browser, page } = await this._createPage();
      page.on('console', event => this._console.push(event));
      page.on('framenavigated', frame => {
        if (!frame.parentFrame())
          this._console.length = 0;
      });
      page.on('close', () => this._onPageClose());
      page.on('filechooser', chooser => this._fileChooser = chooser);
      page.setDefaultNavigationTimeout(60000);
      page.setDefaultTimeout(5000);
      this._page = page;
      this._browser = browser;
      return page;
    })();
    return this._createPagePromise;
  }

  private _onPageClose() {
    const browser = this._browser;
    const page = this._page;
    void page?.context()?.close().then(() => browser?.close()).catch(() => {});

    this._createPagePromise = undefined;
    this._browser = undefined;
    this._page = undefined;
    this._fileChooser = undefined;
    this._console.length = 0;
  }

  async install(): Promise<string> {
    const channel = this._options.launchOptions?.channel ?? this._options.browserName ?? 'chrome';
    const cli = path.join(require.resolve('playwright/package.json'), '..', 'cli.js');
    const child = fork(cli, ['install', channel], {
      stdio: 'pipe',
    });
    const output: string[] = [];
    child.stdout?.on('data', data => output.push(data.toString()));
    child.stderr?.on('data', data => output.push(data.toString()));
    return new Promise((resolve, reject) => {
      child.on('close', code => {
        if (code === 0)
          resolve(channel);
        else
          reject(new Error(`Failed to install browser: ${output.join('')}`));
      });
    });
  }

  existingPage(): playwright.Page {
    if (!this._page)
      throw new Error('Navigate to a location to create a page');
    return this._page;
  }

  async run(callback: (page: playwright.Page) => Promise<void>, options?: RunOptions): Promise<ToolResult> {
    const page = this.existingPage();
    try {
      if (!options?.noClearFileChooser)
        this._fileChooser = undefined;
      if (options?.waitForCompletion)
        await waitForCompletion(page, () => callback(page));
      else
        await callback(page);
    } finally {
      if (options?.captureSnapshot)
        this._snapshot = await PageSnapshot.create(page);
    }
    return {
      content: [{
        type: 'text',
        text: this._snapshot?.text({ status: options?.status, hasFileChooser: !!this._fileChooser }) ?? options?.status ?? '',
      }],
    };
  }

  async runAndWait(callback: (page: playwright.Page) => Promise<void>, options?: RunOptions): Promise<ToolResult> {
    return await this.run(callback, {
      waitForCompletion: true,
      ...options,
    });
  }

  async runAndWaitWithSnapshot(callback: (page: playwright.Page) => Promise<void>, options?: RunOptions): Promise<ToolResult> {
    return await this.run(callback, {
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

  async close() {
    if (!this._page)
      return;
    await this._page.close();
  }

  async submitFileChooser(paths: string[]) {
    if (!this._fileChooser)
      throw new Error('No file chooser visible');
    await this._fileChooser.setFiles(paths);
    this._fileChooser = undefined;
  }

  private async _createPage(): Promise<{ browser?: playwright.Browser, page: playwright.Page }> {
    if (this._options.remoteEndpoint) {
      const url = new URL(this._options.remoteEndpoint);
      if (this._options.browserName)
        url.searchParams.set('browser', this._options.browserName);
      if (this._options.launchOptions)
        url.searchParams.set('launch-options', JSON.stringify(this._options.launchOptions));
      const browser = await playwright[this._options.browserName ?? 'chromium'].connect(String(url));
      const page = await browser.newPage();
      return { browser, page };
    }

    if (this._options.cdpEndpoint) {
      const browser = await playwright.chromium.connectOverCDP(this._options.cdpEndpoint);
      const browserContext = browser.contexts()[0];
      let [page] = browserContext.pages();
      if (!page)
        page = await browserContext.newPage();
      return { browser, page };
    }

    const context = await this._launchPersistentContext();
    const [page] = context.pages();
    return { page };
  }

  private async _launchPersistentContext(): Promise<playwright.BrowserContext> {
    try {
      const browserType = this._options.browserName ? playwright[this._options.browserName] : playwright.chromium;
      return await browserType.launchPersistentContext(this._options.userDataDir, this._options.launchOptions);
    } catch (error: any) {
      if (error.message.includes('Executable doesn\'t exist'))
        throw new Error(`Browser specified in your config is not installed. Either install it (likely) or change the config.`);
      throw error;
    }
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

  text(options?: { status?: string, hasFileChooser?: boolean }): string {
    const results: string[] = [];
    if (options?.status) {
      results.push(options.status);
      results.push('');
    }
    if (options?.hasFileChooser) {
      results.push('- There is a file chooser visible that requires browser_choose_file to be called');
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
