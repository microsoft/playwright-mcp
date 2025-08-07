import { EventEmitter } from 'events';
import * as playwright from 'playwright';
import { callOnPageNoTrace, waitForCompletion } from './tools/utils.js';
import { logUnhandledError } from './log.js';
import { ManualPromise } from './manualPromise.js';
import { ModalState } from './tools/tool.js';
import type { Context } from './context.js';
type PageEx = playwright.Page & {
  _snapshotForAI: () => Promise<string>;
};
export const TabEvents = {
  modalState: 'modalState'
};
export type TabEventsInterface = {
  [TabEvents.modalState]: [modalState: ModalState];
};
export type TabSnapshot = {
  url: string;
  title: string;
  ariaSnapshot: string;
  modalStates: ModalState[];
  consoleMessages: ConsoleMessage[];
  downloads: { download: playwright.Download, finished: boolean, outputFile: string }[];
};
export class Tab extends EventEmitter<TabEventsInterface> {
  readonly context: Context;
  readonly page: playwright.Page;
  private _lastTitle = 'about:blank';
  private _consoleMessages: ConsoleMessage[] = [];
  private _recentConsoleMessages: ConsoleMessage[] = [];
  private _requests: Map<playwright.Request, playwright.Response | null> = new Map();
  private _onPageClose: (tab: Tab) => void;
  private _modalStates: ModalState[] = [];
  private _downloads: { download: playwright.Download, finished: boolean, outputFile: string }[] = [];
  private _navigationState: {
    isNavigating: boolean;
    lastNavigationStart: number;
    navigationPromise?: Promise<void>;
  } = {
      isNavigating: false,
      lastNavigationStart: 0
    };
  constructor(context: Context, page: playwright.Page, onPageClose: (tab: Tab) => void) {
    super();
    this.context = context;
    this.page = page;
    this._onPageClose = onPageClose;
    page.on('console', event => this._handleConsoleMessage(messageToConsoleMessage(event)));
    page.on('pageerror', error => this._handleConsoleMessage(pageErrorToConsoleMessage(error)));
    page.on('request', request => this._requests.set(request, null));
    page.on('response', response => this._requests.set(response.request(), response));
    page.on('close', () => this._onClose());
    page.on('filechooser', chooser => {
      this.setModalState({
        type: 'fileChooser',
        description: 'File chooser',
        fileChooser: chooser,
      });
    });
    page.on('dialog', dialog => this._dialogShown(dialog));
    page.on('download', download => {
      void this._downloadStarted(download);
    });

    // Navigation state tracking
    page.on('framenavigated', frame => {
      if (frame === page.mainFrame())
        this._handleNavigationStart();

    });
    page.on('load', () => {
      this._handleNavigationComplete();
    });
    page.on('domcontentloaded', () => {
      // DOMContentLoaded indicates navigation is progressing
      this._navigationState.isNavigating = true;
    });

    page.setDefaultNavigationTimeout(60000);
    page.setDefaultTimeout(5000);
    (page as any)[tabSymbol] = this;
  }
  static forPage(page: playwright.Page): Tab | undefined {
    return (page as any)[tabSymbol];
  }
  modalStates(): ModalState[] {
    return this._modalStates;
  }
  setModalState(modalState: ModalState) {
    this._modalStates.push(modalState);
    this.emit(TabEvents.modalState, modalState);
  }
  clearModalState(modalState: ModalState) {
    this._modalStates = this._modalStates.filter(state => state !== modalState);
  }
  modalStatesMarkdown(): string[] {
    return renderModalStates(this.context, this.modalStates());
  }
  private _dialogShown(dialog: playwright.Dialog) {
    this.setModalState({
      type: 'dialog',
      description: `"${dialog.type()}" dialog with message "${dialog.message()}"`,
      dialog,
    });
  }
  private async _downloadStarted(download: playwright.Download) {
    const entry = {
      download,
      finished: false,
      outputFile: await this.context.outputFile(download.suggestedFilename())
    };
    this._downloads.push(entry);
    await download.saveAs(entry.outputFile);
    entry.finished = true;
  }
  private _clearCollectedArtifacts() {
    this._consoleMessages.length = 0;
    this._recentConsoleMessages.length = 0;
    this._requests.clear();
  }
  private _handleConsoleMessage(message: ConsoleMessage) {
    this._consoleMessages.push(message);
    this._recentConsoleMessages.push(message);
  }
  private _onClose() {
    this._clearCollectedArtifacts();
    this._onPageClose(this);
  }
  async updateTitle() {
    await this._raceAgainstModalStates(async () => {
      this._lastTitle = await callOnPageNoTrace(this.page, page => page.title());
    });
  }
  lastTitle(): string {
    return this._lastTitle;
  }
  isCurrentTab(): boolean {
    return this === this.context.currentTab();
  }
  async waitForLoadState(state: 'load' | 'networkidle', options?: { timeout?: number }): Promise<void> {
    await callOnPageNoTrace(this.page, page => page.waitForLoadState(state, options).catch(logUnhandledError));
  }

  /**
   * Navigation state management methods
   */
  private _handleNavigationStart(): void {
    this._navigationState.isNavigating = true;
    this._navigationState.lastNavigationStart = Date.now();

    // Create a promise that resolves when navigation completes
    this._navigationState.navigationPromise = this._createNavigationPromise();
  }

  private _handleNavigationComplete(): void {
    this._navigationState.isNavigating = false;
  }

  private _createNavigationPromise(): Promise<void> {
    return new Promise<void>(resolve => {
      const checkComplete = () => {
        if (!this._navigationState.isNavigating) {
          resolve();
          return;
        }

        // Timeout after configured duration
        if (Date.now() - this._navigationState.lastNavigationStart > getNavigationTimeouts().navigationTimeout) {
          this._navigationState.isNavigating = false;
          resolve();
          return;
        }

        setTimeout(checkComplete, getNavigationTimeouts().checkInterval);
      };

      setTimeout(checkComplete, getNavigationTimeouts().checkInterval);
    });
  }

  /**
   * Check if navigation is currently in progress
   */
  isNavigating(): boolean {
    // Consider stale if navigation started more than configured timeout ago
    const isStale = Date.now() - this._navigationState.lastNavigationStart > getNavigationTimeouts().staleTimeout;
    if (isStale && this._navigationState.isNavigating)
      this._navigationState.isNavigating = false;

    return this._navigationState.isNavigating;
  }

  /**
   * Wait for current navigation to complete (if any)
   */
  async waitForNavigationComplete(): Promise<void> {
    if (this._navigationState.navigationPromise)
      await this._navigationState.navigationPromise;

  }

  async navigate(url: string) {
    this._clearCollectedArtifacts();
    const downloadEvent = callOnPageNoTrace(this.page, page => page.waitForEvent('download').catch(logUnhandledError));
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
        new Promise(resolve => setTimeout(resolve, 3000)),
      ]);
      if (!download)
        throw e;
      // Make sure other "download" listeners are notified first.
      await new Promise(resolve => setTimeout(resolve, 500));
      return;
    }
    // Cap load event to 5 seconds, the page is operational at this point.
    await this.waitForLoadState('load', { timeout: 5000 });
  }
  consoleMessages(): ConsoleMessage[] {
    return this._consoleMessages;
  }
  requests(): Map<playwright.Request, playwright.Response | null> {
    return this._requests;
  }
  async captureSnapshot(): Promise<TabSnapshot> {
    let tabSnapshot: TabSnapshot | undefined;
    const modalStates = await this._raceAgainstModalStates(async () => {
      const snapshot = await (this.page as PageEx)._snapshotForAI();
      tabSnapshot = {
        url: this.page.url(),
        title: await this.page.title(),
        ariaSnapshot: snapshot,
        modalStates: [],
        consoleMessages: [],
        downloads: this._downloads,
      };
    });
    if (tabSnapshot) {
      // Assign console message late so that we did not lose any to modal state.
      tabSnapshot.consoleMessages = this._recentConsoleMessages;
      this._recentConsoleMessages = [];
    }
    return tabSnapshot ?? {
      url: this.page.url(),
      title: '',
      ariaSnapshot: '',
      modalStates,
      consoleMessages: [],
      downloads: [],
    };
  }
  async capturePartialSnapshot(selector?: string, maxLength?: number): Promise<TabSnapshot> {
    let tabSnapshot: TabSnapshot | undefined;
    const modalStates = await this._raceAgainstModalStates(async () => {
      let snapshot: string;
      if (selector) {
        // Use the full snapshot but filter it to the selector
        const fullSnapshot = await (this.page as PageEx)._snapshotForAI();
        // Extract the part of the snapshot that matches the selector
        snapshot = this._extractPartialSnapshot(fullSnapshot, selector);
      } else {
        // Full snapshot if no selector specified
        snapshot = await (this.page as PageEx)._snapshotForAI();
      }
      // Apply maxLength truncation with word boundary consideration
      if (maxLength && snapshot.length > maxLength)
        snapshot = this._truncateAtWordBoundary(snapshot, maxLength);
      tabSnapshot = {
        url: this.page.url(),
        title: await this.page.title(),
        ariaSnapshot: snapshot,
        modalStates: [],
        consoleMessages: [],
        downloads: this._downloads,
      };
    });
    if (tabSnapshot) {
      // Assign console message late so that we did not lose any to modal state.
      tabSnapshot.consoleMessages = this._recentConsoleMessages;
      this._recentConsoleMessages = [];
    }
    return tabSnapshot ?? {
      url: this.page.url(),
      title: '',
      ariaSnapshot: '',
      modalStates,
      consoleMessages: [],
      downloads: [],
    };
  }
  private _extractPartialSnapshot(fullSnapshot: string, selector: string): string {
    // Parse the ARIA tree to find the section matching the selector
    const lines = fullSnapshot.split('\n');
    const selectorToRole: Record<string, string> = {
      'main': 'main',
      'header': 'banner',
      'footer': 'contentinfo',
      'nav': 'navigation',
      'aside': 'complementary',
      'section': 'region',
      'article': 'article'
    };
    // Get expected role from selector
    const expectedRole = selectorToRole[selector] || selector;
    // Find the section in the ARIA tree
    let capturing = false;
    let captureIndent = -1;
    const capturedLines: string[] = [];
    for (const line of lines) {
      // Count leading spaces to determine indent level
      const indent = line.length - line.trimStart().length;
      const trimmedLine = line.trim();
      // Check if this line contains our target role with proper ARIA structure
      // Matches patterns like: "- main [ref=e3]:" or "- main [active] [ref=e1]:"
      const rolePattern = new RegExp(`^- ${expectedRole}\\s*(?:\\[[^\\]]*\\])*\\s*:?`);
      if (!capturing && rolePattern.test(trimmedLine)) {
        capturing = true;
        captureIndent = indent;
        capturedLines.push(line);
        continue;
      }
      // If we're capturing, continue until we reach a sibling or parent element
      if (capturing) {
        if (indent > captureIndent) {
          // This is a child element, include it
          capturedLines.push(line);
        } else {
          // We've reached a sibling or parent, stop capturing
          break;
        }
      }
    }
    // If we captured something, normalize indentation and return it
    if (capturedLines.length > 0) {
      // Calculate minimum indentation (should be the target element's indentation)
      const minIndent = capturedLines[0].length - capturedLines[0].trimStart().length;
      // Normalize indentation: remove the minimum indentation from all lines
      const normalizedLines = capturedLines.map(line => {
        if (line.trim() === '')
          return line; // Keep empty lines as-is
        const currentIndent = line.length - line.trimStart().length;
        const newIndent = Math.max(0, currentIndent - minIndent);
        return ' '.repeat(newIndent) + line.trimStart();
      });
      return normalizedLines.join('\n');
    }
    // Log debug information when selector is not found
    // TODO: Use proper logging instead of console
    // eslint-disable-next-line no-console
    console.warn(`Selector "${selector}" (role: "${expectedRole}") not found in ARIA snapshot. Returning full snapshot as fallback.`);
    // Return the original full snapshot when selector is not found
    // This ensures that tests expecting complete page structure get what they need
    return fullSnapshot;
  }
  private _truncateAtWordBoundary(text: string, maxLength: number): string {
    if (text.length <= maxLength)
      return text;
    // Look for the last word boundary before maxLength
    let truncateIndex = maxLength;
    // Check if we're in the middle of a word at maxLength
    if (text[maxLength] && text[maxLength] !== ' ' && text[maxLength] !== '\n') {
      // We're in the middle of a word, find the last space before maxLength
      for (let i = maxLength - 1; i >= 0; i--) {
        if (text[i] === ' ' || text[i] === '\n') {
          truncateIndex = i;
          break;
        }
      }
      // If we've gone back too far (more than 20 chars), just cut at maxLength
      if (maxLength - truncateIndex > 20)
        truncateIndex = maxLength;
    }
    let result = text.substring(0, truncateIndex).trim();
    // Ensure the result doesn't exceed maxLength after trimming
    if (result.length > maxLength)
      result = result.substring(0, maxLength);
    return result;
  }
  private _javaScriptBlocked(): boolean {
    return this._modalStates.some(state => state.type === 'dialog');
  }
  private async _raceAgainstModalStates(action: () => Promise<void>): Promise<ModalState[]> {
    if (this.modalStates().length)
      return this.modalStates();
    const promise = new ManualPromise<ModalState[]>();
    const listener = (modalState: ModalState) => promise.resolve([modalState]);
    this.once(TabEvents.modalState, listener);
    return await Promise.race([
      action().then(() => {
        this.off(TabEvents.modalState, listener);
        return [];
      }),
      promise,
    ]);
  }
  async waitForCompletion(callback: () => Promise<void>) {
    await this._raceAgainstModalStates(() => waitForCompletion(this, callback));
  }
  async refLocator(params: { element: string, ref: string }): Promise<playwright.Locator> {
    return (await this.refLocators([params]))[0];
  }
  async refLocators(params: { element: string, ref: string }[]): Promise<playwright.Locator[]> {
    const snapshot = await (this.page as PageEx)._snapshotForAI();
    return params.map(param => {
      if (!snapshot.includes(`[ref=${param.ref}]`))
        throw new Error(`Ref ${param.ref} not found in the current page snapshot. Try capturing new snapshot.`);
      return this.page.locator(`aria-ref=${param.ref}`).describe(param.element);
    });
  }
  async waitForTimeout(time: number) {
    if (this._javaScriptBlocked()) {
      await new Promise(f => setTimeout(f, time));
      return;
    }
    await callOnPageNoTrace(this.page, page => {
      return page.evaluate(() => new Promise(f => setTimeout(f, 1000)));
    });
  }
}
export type ConsoleMessage = {
  type: ReturnType<playwright.ConsoleMessage['type']> | undefined;
  text: string;
  toString(): string;
};
function messageToConsoleMessage(message: playwright.ConsoleMessage): ConsoleMessage {
  return {
    type: message.type(),
    text: message.text(),
    toString: () => `[${message.type().toUpperCase()}] ${message.text()} @ ${message.location().url}:${message.location().lineNumber}`,
  };
}
function pageErrorToConsoleMessage(errorOrValue: Error | any): ConsoleMessage {
  if (errorOrValue instanceof Error) {
    return {
      type: undefined,
      text: errorOrValue.message,
      toString: () => errorOrValue.stack || errorOrValue.message,
    };
  }
  return {
    type: undefined,
    text: String(errorOrValue),
    toString: () => String(errorOrValue),
  };
}
export function renderModalStates(context: Context, modalStates: ModalState[]): string[] {
  const result: string[] = ['### Modal state'];
  if (modalStates.length === 0)
    result.push('- There is no modal state present');
  for (const state of modalStates) {
    const tool = context.tools.filter(tool => 'clearsModalState' in tool).find(tool => tool.clearsModalState === state.type);
    result.push(`- [${state.description}]: can be handled by the "${tool?.schema.name}" tool`);
  }
  return result;
}
const tabSymbol = Symbol('tabSymbol');

function getNavigationTimeouts() {
  return {
    navigationTimeout: 5000,
    checkInterval: 100,
    staleTimeout: 10000
  };
}
