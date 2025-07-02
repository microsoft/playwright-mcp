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

import { PageSnapshot } from './pageSnapshot.js';

import type { Context } from './context.js';
import { callOnPageNoTrace } from './tools/utils.js';

export class Tab {
  readonly context: Context;
  readonly page: playwright.Page;
  private _consoleMessages: playwright.ConsoleMessage[] = [];
  private _requests: Map<playwright.Request, playwright.Response | null> = new Map();
  private _snapshot: PageSnapshot | undefined;
  private _onPageClose: (tab: Tab) => void;

  constructor(context: Context, page: playwright.Page, onPageClose: (tab: Tab) => void) {
    this.context = context;
    this.page = page;
    this._onPageClose = onPageClose;
    page.on('console', event => this._consoleMessages.push(event));
    page.on('request', request => this._requests.set(request, null));
    page.on('response', response => this._requests.set(response.request(), response));
    page.on('close', () => this._onClose());
    page.on('filechooser', chooser => {
      this.context.setModalState({
        type: 'fileChooser',
        description: 'File chooser',
        fileChooser: chooser,
      }, this);
    });
    page.on('dialog', dialog => this.context.dialogShown(this, dialog));
    page.on('download', download => {
      void this.context.downloadStarted(this, download);
    });
    page.setDefaultNavigationTimeout(60000);
    page.setDefaultTimeout(5000);
  }

  private _clearCollectedArtifacts() {
    this._consoleMessages.length = 0;
    this._requests.clear();
  }

  private _onClose() {
    this._clearCollectedArtifacts();
    this._onPageClose(this);
  }

  async title(): Promise<string> {
    return await callOnPageNoTrace(this.page, page => page.title());
  }

  async waitForLoadState(state: 'load', options?: { timeout?: number }): Promise<void> {
    await callOnPageNoTrace(this.page, page => page.waitForLoadState(state, options).catch(() => {}));
  }

  async navigate(url: string) {
    this._clearCollectedArtifacts();

    const downloadEvent = callOnPageNoTrace(this.page, page => page.waitForEvent('download').catch(() => {}));
    try {
      await this.page.goto(url, { waitUntil: 'domcontentloaded' });
    } catch (_e: unknown) {
      const e = _e as Error;
      const mightBeDownload =
        e.message.includes('net::ERR_ABORTED') // chromium
        || e.message.includes('Download is starting'); // firefox + webkit
      if (!mightBeDownload)
        throw e;
      // on chromium, the download event is fired *after* page.goto rejects, so we wait a lil bit
      const download = await Promise.race([
        downloadEvent,
        new Promise(resolve => setTimeout(resolve, 1000)),
      ]);
      if (!download)
        throw e;
    }

    // Cap load event to 5 seconds, the page is operational at this point.
    await this.waitForLoadState('load', { timeout: 5000 });
  }

  hasSnapshot(): boolean {
    return !!this._snapshot;
  }

  snapshotOrDie(): PageSnapshot {
    if (!this._snapshot)
      throw new Error('No snapshot available');
    return this._snapshot;
  }

  consoleMessages(): playwright.ConsoleMessage[] {
    return this._consoleMessages;
  }

  requests(): Map<playwright.Request, playwright.Response | null> {
    return this._requests;
  }

  async captureSnapshot() {
    this._snapshot = await PageSnapshot.create(this.page);
  }
}
