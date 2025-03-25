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
import playwright from 'playwright';

import { storageStateFolder, storageStatePath, storageStatePathIfExists } from './tools/utils';

export class Context {
  private _launchOptions: playwright.LaunchOptions | undefined;
  private _browser: playwright.Browser | undefined;
  private _page: playwright.Page | undefined;
  private _console: playwright.ConsoleMessage[] = [];

  constructor(launchOptions?: playwright.LaunchOptions) {
    this._launchOptions = launchOptions;
  }

  async existingPage(): Promise<playwright.Page> {
    if (!this._page)
      throw new Error('Start with navigating to a page');
    return this._page;
  }

  async navigate(url: string, restoreState: boolean = false): Promise<playwright.Page> {
    if (restoreState && this._page) {
      await this._page.close();
      this._page = undefined;
    }

    if (!this._browser) {
      this._browser = await createBrowser(this._launchOptions);
      this._browser.on('disconnected', () => {
        this._browser = undefined;
        this._reset();
      });
    }

    if (!this._page) {
      const newOrigin = new URL(url).origin;
      this._page = await this._browser.newPage({
        storageState: restoreState ? await storageStatePathIfExists(newOrigin) : undefined,
      });
      this._page.on('console', event => this._console.push(event));
      this._page.on('framenavigated', frame => {
        if (!frame.parentFrame())
          this._console.length = 0;
      });
      this._page.on('close', () => this._reset());
    }

    await this._page.goto(url, { waitUntil: 'domcontentloaded' });
    await this._page.waitForLoadState('load', { timeout: 5000 }).catch(() => { });
    return this._page;
  }

  async saveState(): Promise<{ origin: string; filename: string }> {
    const page = await this.existingPage();
    const origin = new URL(page.url()).origin;
    const filename = await storageStatePath(origin);
    await page.context().storageState({ path: filename });
    return { origin, filename };
  }

  async clearSavedState(origin: string | undefined) {
    if (origin) {
      const filename = await storageStatePath(origin);
      await fs.promises.unlink(filename).catch(() => { });
    } else {
      const folder = await storageStateFolder();
      await fs.promises.rm(folder, { recursive: true, force: true }).catch(() => { });
    }
  }

  async console(): Promise<playwright.ConsoleMessage[]> {
    if (!this._page)
      return [];
    return this._console;
  }

  async close() {
    if (this._page)
      await this._page.close();
  }

  private _reset() {
    this._page = undefined;
    this._console.length = 0;
  }
}

async function createBrowser(launchOptions?: playwright.LaunchOptions): Promise<playwright.Browser> {
  if (process.env.PLAYWRIGHT_WS_ENDPOINT) {
    const url = new URL(process.env.PLAYWRIGHT_WS_ENDPOINT);
    url.searchParams.set('launch-options', JSON.stringify(launchOptions));
    return await playwright.chromium.connect(String(url));
  }
  return await playwright.chromium.launch({ channel: 'chrome', ...launchOptions });
}
