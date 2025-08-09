import type {
  ImageContent,
  TextContent,
} from '@modelcontextprotocol/sdk/types.js';
import { TIMEOUTS } from './config/constants.js';
import type { Context } from './context.js';
import type { ExpectationOptions } from './schemas/expectation.js';
import { mergeExpectations } from './schemas/expectation.js';
import type { ConsoleMessage, Tab, TabSnapshot } from './tab.js';
import { renderModalStates } from './tab.js';
import type { DiffResult } from './types/diff.js';
import { processImage } from './utils/imageProcessor.js';
import { TextReportBuilder } from './utils/reportBuilder.js';
import { ResponseDiffDetector } from './utils/responseDiffDetector.js';
export class Response {
  private readonly _result: string[] = [];
  private readonly _code: string[] = [];
  private readonly _images: { contentType: string; data: Buffer }[] = [];
  private readonly _context: Context;
  private _includeSnapshot = false;
  private _includeTabs = false;
  private _tabSnapshot: TabSnapshot | undefined;
  private readonly _expectation: NonNullable<ExpectationOptions>;
  private _diffResult: DiffResult | undefined;
  readonly toolName: string;
  readonly toolArgs: Record<string, unknown>;
  private _isError: boolean | undefined;
  // Static diff detector instance shared across all responses
  private static readonly diffDetector: ResponseDiffDetector =
    new ResponseDiffDetector();
  constructor(
    context: Context,
    toolName: string,
    toolArgs: Record<string, unknown>,
    expectation?: ExpectationOptions
  ) {
    this._context = context;
    this.toolName = toolName;
    this.toolArgs = toolArgs;
    // Use expectation from toolArgs if not provided directly
    const actualExpectation =
      expectation || (toolArgs.expectation as ExpectationOptions | undefined);
    this._expectation = mergeExpectations(toolName, actualExpectation);
  }
  addResult(result: string) {
    this._result.push(result);
  }
  addError(error: string) {
    this._result.push(error);
    this._isError = true;
  }
  isError() {
    return this._isError;
  }
  result() {
    return this._result.join('\n');
  }
  addCode(code: string) {
    this._code.push(code);
  }
  code() {
    return this._code.join('\n');
  }
  addImage(image: { contentType: string; data: Buffer }) {
    this._images.push(image);
  }
  images() {
    return this._images;
  }
  setIncludeSnapshot() {
    this._includeSnapshot = true;
  }
  setIncludeTabs() {
    this._includeTabs = true;
  }
  setTabSnapshot(snapshot: TabSnapshot) {
    this._tabSnapshot = snapshot;
  }
  async finish() {
    // All the async snapshotting post-action is happening here.
    // Everything below should race against modal states.
    // Expectation settings take priority over legacy setIncludeSnapshot calls
    const shouldIncludeSnapshot =
      this._expectation.includeSnapshot || this._includeSnapshot;
    if (shouldIncludeSnapshot && this._context.currentTab()) {
      // Enhanced navigation detection and deferred execution
      await this._captureSnapshotWithNavigationHandling();
    }
    await Promise.all(this._context.tabs().map((tab) => tab.updateTitle()));
    // Process images if image options are specified
    if (this._expectation.imageOptions && this._images.length > 0) {
      // Process all images in parallel
      const processedImages = await Promise.all(
        this._images.map(async (image) => {
          try {
            const processedResult = await processImage(
              image.data,
              image.contentType,
              this._expectation.imageOptions
            );
            return {
              contentType: processedResult.contentType,
              data: processedResult.data,
            };
          } catch (error) {
            // If processing fails, keep the original image
            console.warn('Image processing failed:', error);
            return image;
          }
        })
      );
      // Replace original images with processed ones
      this._images.length = 0;
      this._images.push(...processedImages);
    }
    // Perform diff detection if enabled
    if (this._expectation.diffOptions?.enabled) {
      try {
        const currentContent = this.buildContentForDiff();
        // Ensure diffOptions has all required fields with defaults
        const diffOptions = {
          enabled: this._expectation.diffOptions.enabled,
          threshold: this._expectation.diffOptions.threshold ?? 0.1,
          format: this._expectation.diffOptions.format ?? 'unified',
          maxDiffLines: this._expectation.diffOptions.maxDiffLines ?? 50,
          ignoreWhitespace:
            this._expectation.diffOptions.ignoreWhitespace ?? true,
          context: this._expectation.diffOptions.context ?? 3,
        };
        this._diffResult = Response.diffDetector.detectDiff(
          currentContent,
          this.toolName,
          diffOptions
        );
      } catch (error) {
        // Gracefully handle diff detection errors
        console.warn('Diff detection failed:', error);
        this._diffResult = undefined;
      }
    }
  }
  tabSnapshot(): TabSnapshot | undefined {
    return this._tabSnapshot;
  }
  serialize(): { content: (TextContent | ImageContent)[]; isError?: boolean } {
    const response: string[] = [];
    this._addDiffSectionToResponse(response);
    this._addResultSectionToResponse(response);
    this._addCodeSectionToResponse(response);
    const { shouldIncludeTabs, shouldIncludeSnapshot } =
      this._getInclusionFlags();

    if (shouldIncludeTabs) {
      response.push(...renderTabsMarkdown(this._context.tabs(), true));
    }
    this._addSnapshotSectionToResponse(response, shouldIncludeSnapshot);
    // Main response part
    const content: (TextContent | ImageContent)[] = [
      { type: 'text', text: response.join('\n') },
    ];
    // Image attachments.
    if (this._context.config.imageResponses !== 'omit') {
      for (const image of this._images) {
        content.push({
          type: 'image',
          data: image.data.toString('base64'),
          mimeType: image.contentType,
        });
      }
    }
    return { content, isError: this._isError };
  }
  private renderFilteredTabSnapshot(tabSnapshot: TabSnapshot): string {
    const sections = [
      this.buildConsoleSection(tabSnapshot),
      this.buildDownloadsSection(tabSnapshot),
      this.buildPageStateSection(tabSnapshot),
    ].filter(Boolean);

    return sections.join('\n');
  }

  private buildConsoleSection(tabSnapshot: TabSnapshot): string | null {
    if (
      !(this._expectation.includeConsole && tabSnapshot.consoleMessages.length)
    ) {
      return null;
    }

    const filteredMessages = this.filterConsoleMessages(
      tabSnapshot.consoleMessages,
      this._expectation.consoleOptions
    );

    if (!filteredMessages.length) {
      return null;
    }

    return this.buildSection('New console messages', (b) => {
      for (const message of filteredMessages) {
        b.addListItem(trim(message.toString(), 100));
      }
    });
  }

  private buildDownloadsSection(tabSnapshot: TabSnapshot): string | null {
    if (!(this._expectation.includeDownloads && tabSnapshot.downloads.length)) {
      return null;
    }

    return this.buildSection('Downloads', (b) => {
      for (const entry of tabSnapshot.downloads) {
        const filename = entry.download.suggestedFilename();
        const status = entry.finished
          ? `Downloaded file ${filename} to ${entry.outputFile}`
          : `Downloading file ${filename} ...`;
        b.addListItem(status);
      }
    });
  }

  private buildPageStateSection(tabSnapshot: TabSnapshot): string {
    return this.buildSection('Page state', (b) => {
      b.addKeyValue('Page URL', tabSnapshot.url);
      b.addKeyValue('Page Title', tabSnapshot.title);

      if (this._expectation.includeSnapshot) {
        b.addLine('- Page Snapshot:');
        b.addCodeBlock(tabSnapshot.ariaSnapshot, 'yaml');
      }
    });
  }

  private buildSection(
    title: string,
    contentFn: (builder: TextReportBuilder) => void
  ): string {
    const builder = new TextReportBuilder();
    builder.addSection(title, contentFn);
    return builder.getSections().join('\n');
  }
  private filterConsoleMessages(
    messages: ConsoleMessage[],
    options?: NonNullable<ExpectationOptions>['consoleOptions']
  ): ConsoleMessage[] {
    return this._applyConsoleFilters(
      messages,
      options ?? { maxMessages: 10, removeDuplicates: false }
    );
  }

  private _applyConsoleFilters(
    messages: ConsoleMessage[],
    options: NonNullable<ExpectationOptions>['consoleOptions']
  ): ConsoleMessage[] {
    const levelFiltered = this._filterByLevels(messages, options?.levels);
    return this._limitMessages(levelFiltered, options?.maxMessages ?? 10);
  }

  private _filterByLevels(
    messages: ConsoleMessage[],
    levels?: ('log' | 'warn' | 'error' | 'info')[]
  ): ConsoleMessage[] {
    if (!levels?.length) {
      return messages;
    }

    return messages.filter((msg) => {
      const level = (msg.type ?? 'log') as 'log' | 'warn' | 'error' | 'info';
      return levels.includes(level);
    });
  }

  private _limitMessages(
    messages: ConsoleMessage[],
    maxMessages: number
  ): ConsoleMessage[] {
    return messages.length > maxMessages
      ? messages.slice(0, maxMessages)
      : messages;
  }

  private _addDiffSectionToResponse(response: string[]): void {
    if (!(this._diffResult?.hasDifference && this._diffResult.formattedDiff)) {
      return;
    }

    response.push(
      '### Changes from previous response',
      `Similarity: ${(this._diffResult.similarity * 100).toFixed(1)}%`,
      `Changes: ${this._diffResult.metadata.addedLines} additions, ${this._diffResult.metadata.removedLines} deletions`,
      '',
      '```diff',
      this._diffResult.formattedDiff,
      '```',
      ''
    );
  }

  private _addResultSectionToResponse(response: string[]): void {
    if (this._result.length) {
      response.push('### Result', this._result.join('\n'), '');
    }
  }

  private _addCodeSectionToResponse(response: string[]): void {
    if (this._code.length && this._expectation.includeCode) {
      response.push(
        `### Ran Playwright code\n\`\`\`js\n${this._code.join('\n')}\n\`\`\``,
        ''
      );
    }
  }

  private _getInclusionFlags() {
    return {
      shouldIncludeTabs: this._expectation.includeTabs || this._includeTabs,
      shouldIncludeSnapshot:
        this._expectation.includeSnapshot || this._includeSnapshot,
    };
  }

  private _addSnapshotSectionToResponse(
    response: string[],
    shouldIncludeSnapshot: boolean
  ): void {
    if (!(shouldIncludeSnapshot && this._tabSnapshot)) {
      return;
    }

    if (this._tabSnapshot.modalStates.length) {
      response.push(
        ...renderModalStates(this._context, this._tabSnapshot.modalStates),
        ''
      );
    } else {
      response.push(this.renderFilteredTabSnapshot(this._tabSnapshot), '');
    }
  }
  /**
   * Build content string for diff detection
   * Includes all relevant response information to detect meaningful changes
   */
  private buildContentForDiff(): string {
    const sections = [
      this.buildResultDiffSection(),
      this.buildCodeDiffSection(),
      this.buildSnapshotDiffSection(),
      this.buildConsoleMessagesDiffSection(),
    ].filter(Boolean);

    return sections.join('\n');
  }

  private buildResultDiffSection(): string | null {
    return this._result.length
      ? ['### Result', this._result.join('\n')].join('\n')
      : null;
  }

  private buildCodeDiffSection(): string | null {
    return this._code.length
      ? ['### Code', this._code.join('\n')].join('\n')
      : null;
  }

  private buildSnapshotDiffSection(): string | null {
    if (!(this._tabSnapshot && this._expectation.includeSnapshot)) {
      return null;
    }

    return [
      '### Page State',
      `URL: ${this._tabSnapshot.url}`,
      `Title: ${this._tabSnapshot.title}`,
      'Snapshot:',
      this._tabSnapshot.ariaSnapshot,
    ].join('\n');
  }

  private buildConsoleMessagesDiffSection(): string | null {
    if (
      !(
        this._tabSnapshot?.consoleMessages.length &&
        this._expectation.includeConsole
      )
    ) {
      return null;
    }

    const filteredMessages = this.filterConsoleMessages(
      this._tabSnapshot.consoleMessages,
      this._expectation.consoleOptions
    );

    if (!filteredMessages.length) {
      return null;
    }

    const messageLines = filteredMessages.map((msg) => `- ${msg.toString()}`);
    return ['### Console Messages', ...messageLines].join('\n');
  }

  private _getNavigationRetryConfig() {
    return {
      maxRetries: 3,
      retryDelay: TIMEOUTS.RETRY_DELAY,
      stabilityTimeout: TIMEOUTS.STABILITY_TIMEOUT,
      evaluationTimeout: 200,
    } as const;
  }

  private async _captureSnapshotWithNavigationHandling(): Promise<void> {
    const currentTab = this._context.currentTabOrDie();
    const { maxRetries } = this._getNavigationRetryConfig();

    await this._executeWithRetry(
      () => this._performSnapshotCapture(currentTab),
      maxRetries
    );
  }

  private async _executeWithRetry(
    operation: () => Promise<void>,
    maxRetries: number
  ): Promise<void> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // biome-ignore lint/nursery/noAwaitInLoop: Sequential retry logic is required
        await operation();
        return;
      } catch (error: unknown) {
        const shouldRetry = await this._handleSnapshotError(
          error,
          attempt,
          maxRetries,
          this._getNavigationRetryConfig().retryDelay,
          this._context.currentTabOrDie()
        );
        if (!shouldRetry) {
          break;
        }
      }
    }
  }

  private async _performSnapshotCapture(tab: Tab): Promise<void> {
    await this._handleNavigationIfNeeded(tab);
    await this._attemptSnapshotCapture(tab);
  }

  private async _handleNavigationIfNeeded(tab: Tab): Promise<void> {
    if (await this._isPageNavigating(tab)) {
      await this._waitForNavigationStability(tab);
    }
  }

  private async _attemptSnapshotCapture(tab: Tab): Promise<void> {
    const options = this._expectation.snapshotOptions;
    if (options?.selector || options?.maxLength) {
      this._tabSnapshot = await tab.capturePartialSnapshot(
        options.selector,
        options.maxLength
      );
    } else {
      this._tabSnapshot = await tab.captureSnapshot();
    }
  }

  private async _handleSnapshotError(
    error: unknown,
    attempt: number,
    maxRetries: number,
    retryDelay: number,
    tab: Tab
  ): Promise<boolean> {
    const errorMessage = (error as Error)?.message ?? '';

    if (this._isRecoverableError(errorMessage) && attempt < maxRetries) {
      await this._delayRetry(retryDelay, attempt);
      return true;
    }

    if (attempt === maxRetries) {
      await this._handleFinalFailure(tab);
    }

    return false;
  }

  private _isRecoverableError(errorMessage: string): boolean {
    const recoverableErrors = [
      'Execution context was destroyed',
      'Target closed',
      'Session closed',
    ];
    return recoverableErrors.some((err) => errorMessage.includes(err));
  }

  private async _delayRetry(
    retryDelay: number,
    attempt: number
  ): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, retryDelay * attempt));
  }

  private async _handleFinalFailure(tab: Tab): Promise<void> {
    try {
      this._tabSnapshot = await this._captureBasicSnapshot(tab);
    } catch (error) {
      console.warn('Failed to capture basic snapshot:', error);
      this._tabSnapshot = undefined;
    }
  }

  private async _isPageNavigating(tab: Tab): Promise<boolean> {
    try {
      // Check Tab's internal navigation state first
      if (this._hasInternalNavigationState(tab)) {
        return (tab as { isNavigating: () => boolean }).isNavigating();
      }

      // Race condition: evaluate navigation state with timeout
      const navigationState = await this._evaluateNavigationState(tab);
      return this._isNavigationInProgress(navigationState);
    } catch (error) {
      console.debug('Navigation check failed (assuming in progress):', error);
      return true;
    }
  }

  private _hasInternalNavigationState(tab: Tab): boolean {
    return (
      'isNavigating' in tab &&
      typeof (tab as { isNavigating?: () => boolean }).isNavigating ===
        'function'
    );
  }

  private async _evaluateNavigationState(
    tab: Tab
  ): Promise<[string | null, boolean | null]> {
    return (await Promise.race([
      tab.page
        .evaluate(() => [
          document.readyState,
          (window as { performance?: { timing?: { loadEventEnd?: number } } })
            .performance?.timing?.loadEventEnd === 0,
        ])
        .catch(() => [null, null]),
      new Promise<[null, null]>((resolve) =>
        setTimeout(
          () => resolve([null, null]),
          this._getNavigationRetryConfig().evaluationTimeout
        )
      ),
    ])) as [string | null, boolean | null];
  }

  private _isNavigationInProgress(
    state: [string | null, boolean | null]
  ): boolean {
    const [readyState, isLoading] = state;
    return readyState === 'loading' || isLoading === true;
  }

  private async _waitForNavigationStability(tab: Tab): Promise<void> {
    // Try built-in navigation completion first
    if (await this._tryBuiltInNavigationCompletion(tab)) {
      return;
    }

    // Fall back to manual stability checking
    await this._performManualStabilityCheck(tab);
  }

  private async _tryBuiltInNavigationCompletion(tab: Tab): Promise<boolean> {
    if (!this._hasNavigationCompletionMethod(tab)) {
      return false;
    }

    try {
      await (
        tab as { waitForNavigationComplete: () => Promise<void> }
      ).waitForNavigationComplete();
      return true;
    } catch (error) {
      console.debug('Tab navigation completion failed:', error);
      return false;
    }
  }

  private _hasNavigationCompletionMethod(tab: Tab): boolean {
    return (
      'waitForNavigationComplete' in tab &&
      typeof (tab as { waitForNavigationComplete?: () => Promise<void> })
        .waitForNavigationComplete === 'function'
    );
  }

  private async _performManualStabilityCheck(tab: Tab): Promise<void> {
    const { stabilityTimeout } = this._getNavigationRetryConfig();
    const startTime = Date.now();

    while (Date.now() - startTime < stabilityTimeout) {
      // biome-ignore lint/nursery/noAwaitInLoop: Sequential stability checking is required
      if (await this._checkPageStability(tab)) {
        await new Promise((resolve) => setTimeout(resolve, 200));
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  private async _checkPageStability(tab: Tab): Promise<boolean> {
    try {
      await tab.page.waitForLoadState('load', {
        timeout: TIMEOUTS.MEDIUM_DELAY,
      });
      await tab.page
        .waitForLoadState('networkidle', { timeout: TIMEOUTS.SHORT_DELAY })
        .catch(() => {
          // Ignore networkidle timeout as it's not critical for stability check
        });

      return await tab.page
        .evaluate(() => document.readyState === 'complete')
        .catch(() => false);
    } catch (error) {
      console.debug('Page stability check failed (retrying):', error);
      return false;
    }
  }

  private async _captureBasicSnapshot(tab: Tab): Promise<TabSnapshot> {
    try {
      return await tab.captureSnapshot();
    } catch (error) {
      console.warn(
        'Basic snapshot capture failed, creating minimal snapshot:',
        error
      );
      return await this._createMinimalSnapshot(tab);
    }
  }

  private async _createMinimalSnapshot(tab: Tab): Promise<TabSnapshot> {
    const url = tab.page.url();
    const title = await tab.page.title().catch(() => '');

    return {
      url,
      title,
      ariaSnapshot: '// Snapshot unavailable due to navigation context issues',
      modalStates: [],
      consoleMessages: [],
      downloads: [],
    };
  }
}
function renderTabsMarkdown(tabs: Tab[], force = false): string[] {
  if (tabs.length === 1 && !force) {
    return [];
  }
  if (!tabs.length) {
    return [
      '### Open tabs',
      'No open tabs. Use the "browser_navigate" tool to navigate to a page first.',
      '',
    ];
  }
  const lines: string[] = ['### Open tabs'];
  for (let i = 0; i < tabs.length; i++) {
    const tab = tabs[i];
    const current = tab.isCurrentTab() ? ' (current)' : '';
    lines.push(`- ${i}:${current} [${tab.lastTitle()}] (${tab.page.url()})`);
  }
  lines.push('');
  return lines;
}
function trim(text: string, maxLength: number) {
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength)}...`;
}
