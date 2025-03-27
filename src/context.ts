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

export class Context {
  private _userDataDir: string;
  private _launchOptions: playwright.LaunchOptions | undefined;
  private _browser: playwright.Browser | undefined;
  private _page: playwright.Page | undefined;
  private _console: playwright.ConsoleMessage[] = [];
  private _createPagePromise: Promise<playwright.Page> | undefined;
  private _fileChooser: playwright.FileChooser | undefined;
  private _lastSnapshotFrames: playwright.FrameLocator[] = [];

  constructor(userDataDir: string, launchOptions?: playwright.LaunchOptions) {
    this._userDataDir = userDataDir;
    this._launchOptions = launchOptions;
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

  existingPage(): playwright.Page {
    if (!this._page)
      throw new Error('Navigate to a location to create a page');
    return this._page;
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

  hasFileChooser() {
    return !!this._fileChooser;
  }

  clearFileChooser() {
    this._fileChooser = undefined;
  }

  private async _createPage(): Promise<{ browser?: playwright.Browser, page: playwright.Page }> {
    if (process.env.PLAYWRIGHT_WS_ENDPOINT) {
      const url = new URL(process.env.PLAYWRIGHT_WS_ENDPOINT);
      if (this._launchOptions)
        url.searchParams.set('launch-options', JSON.stringify(this._launchOptions));
      const browser = await playwright.chromium.connect(String(url));
      const page = await browser.newPage();
      return { browser, page };
    }

    const context = await playwright.chromium.launchPersistentContext(this._userDataDir, this._launchOptions);
    const [page] = context.pages();
    return { page };
  }

  async allFramesSnapshot() {
    const page = this.existingPage();
    const visibleFrames = await page.locator('iframe').filter({ visible: true }).all();
    this._lastSnapshotFrames = visibleFrames.map(frame => frame.contentFrame());

    const snapshots = await Promise.all([
      page.locator('html').ariaSnapshot({ ref: true }),
      ...this._lastSnapshotFrames.map(async (frame, index) => {
        const snapshot = await frame.locator('html').ariaSnapshot({ ref: true });
        const args = [];
        const src = await frame.owner().getAttribute('src');
        if (src)
          args.push(`src=${src}`);
        const name = await frame.owner().getAttribute('name');
        if (name)
          args.push(`name=${name}`);
        return `\n# iframe ${args.join(' ')}\n` + snapshot.replaceAll('[ref=', `[ref=f${index}`);
      })
    ]);

    return snapshots.join('\n');
  }

  refLocator(ref: string): playwright.Locator {
    const page = this.existingPage();
    let frame: playwright.Frame | playwright.FrameLocator = page.mainFrame();
    const match = ref.match(/^f(\d+)(.*)/);
    if (match) {
      const frameIndex = parseInt(match[1], 10);
      if (!this._lastSnapshotFrames[frameIndex])
        throw new Error(`Frame does not exist. Provide ref from the most current snapshot.`);
      frame = this._lastSnapshotFrames[frameIndex];
      ref = match[2];
    }

    return frame.locator(`aria-ref=${ref}`);
  }
}
