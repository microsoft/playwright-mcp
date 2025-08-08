import type {
  ImageContent,
  TextContent,
} from '@modelcontextprotocol/sdk/types.js';
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
  private _result: string[] = [];
  private _code: string[] = [];
  private _images: { contentType: string; data: Buffer }[] = [];
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
      this._images = processedImages;
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
    // Add diff information if available and has differences
    if (this._diffResult?.hasDifference && this._diffResult.formattedDiff) {
      response.push('### Changes from previous response');
      response.push(
        `Similarity: ${(this._diffResult.similarity * 100).toFixed(1)}%`
      );
      response.push(
        `Changes: ${this._diffResult.metadata.addedLines} additions, ${this._diffResult.metadata.removedLines} deletions`
      );
      response.push('');
      response.push('```diff');
      response.push(this._diffResult.formattedDiff);
      response.push('```');
      response.push('');
    }
    // Start with command result.
    if (this._result.length) {
      response.push('### Result');
      response.push(this._result.join('\n'));
      response.push('');
    }
    // Add code if it exists and expectation allows it.
    if (this._code.length && this._expectation.includeCode) {
      response.push(`### Ran Playwright code
\`\`\`js
${this._code.join('\n')}
\`\`\``);
      response.push('');
    }
    // List browser tabs based on expectation.
    const shouldIncludeTabs =
      this._expectation.includeTabs || this._includeTabs;
    const shouldIncludeSnapshot =
      this._expectation.includeSnapshot || this._includeSnapshot;
    if (shouldIncludeTabs) {
      const tabsMarkdown = renderTabsMarkdown(this._context.tabs(), true);
      response.push(...tabsMarkdown);
    }
    // Add snapshot if provided and expectation allows it.
    if (shouldIncludeSnapshot && this._tabSnapshot?.modalStates.length) {
      response.push(
        ...renderModalStates(this._context, this._tabSnapshot.modalStates)
      );
      response.push('');
    } else if (shouldIncludeSnapshot && this._tabSnapshot) {
      response.push(this.renderFilteredTabSnapshot(this._tabSnapshot));
      response.push('');
    }
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
    const lines: string[] = [];

    this.addConsoleMessagesToLines(lines, tabSnapshot);
    this.addDownloadsToLines(lines, tabSnapshot);
    this.addPageStateToLines(lines, tabSnapshot);

    return lines.join('\n');
  }

  private addConsoleMessagesToLines(
    lines: string[],
    tabSnapshot: TabSnapshot
  ): void {
    if (
      !(this._expectation.includeConsole && tabSnapshot.consoleMessages.length)
    ) {
      return;
    }

    const filteredMessages = this.filterConsoleMessages(
      tabSnapshot.consoleMessages,
      this._expectation.consoleOptions
    );

    if (filteredMessages.length) {
      const builder = new TextReportBuilder();
      builder.addSection('New console messages', (b) => {
        for (const message of filteredMessages) {
          b.addListItem(trim(message.toString(), 100));
        }
      });
      lines.push(...builder.getSections());
    }
  }

  private addDownloadsToLines(lines: string[], tabSnapshot: TabSnapshot): void {
    if (!(this._expectation.includeDownloads && tabSnapshot.downloads.length)) {
      return;
    }

    const builder = new TextReportBuilder();
    builder.addSection('Downloads', (b) => {
      for (const entry of tabSnapshot.downloads) {
        if (entry.finished) {
          b.addListItem(
            `Downloaded file ${entry.download.suggestedFilename()} to ${entry.outputFile}`
          );
        } else {
          b.addListItem(
            `Downloading file ${entry.download.suggestedFilename()} ...`
          );
        }
      }
    });
    lines.push(...builder.getSections());
  }

  private addPageStateToLines(lines: string[], tabSnapshot: TabSnapshot): void {
    const builder = new TextReportBuilder();
    builder.addSection('Page state', (b) => {
      b.addKeyValue('Page URL', tabSnapshot.url);
      b.addKeyValue('Page Title', tabSnapshot.title);

      if (this._expectation.includeSnapshot) {
        b.addLine('- Page Snapshot:');
        b.addCodeBlock(tabSnapshot.ariaSnapshot, 'yaml');
      }
    });
    lines.push(...builder.getSections());
  }
  private filterConsoleMessages(
    messages: ConsoleMessage[],
    options?: NonNullable<ExpectationOptions>['consoleOptions']
  ): ConsoleMessage[] {
    let filtered = messages;
    // Filter by levels if specified
    if (options?.levels && options.levels.length > 0) {
      filtered = filtered.filter((msg) => {
        const level = msg.type || 'log';
        return options.levels?.includes(
          level as 'log' | 'warn' | 'error' | 'info'
        );
      });
    }
    // Limit number of messages
    const maxMessages = options?.maxMessages ?? 10;
    if (filtered.length > maxMessages) {
      filtered = filtered.slice(0, maxMessages);
    }
    return filtered;
  }
  /**
   * Build content string for diff detection
   * Includes all relevant response information to detect meaningful changes
   */
  private buildContentForDiff(): string {
    const content: string[] = [];
    // Include result content
    if (this._result.length) {
      content.push('### Result');
      content.push(this._result.join('\n'));
    }
    // Include code if available
    if (this._code.length) {
      content.push('### Code');
      content.push(this._code.join('\n'));
    }
    // Include tab snapshot if available and expectation allows it
    if (this._tabSnapshot && this._expectation.includeSnapshot) {
      content.push('### Page State');
      content.push(`URL: ${this._tabSnapshot.url}`);
      content.push(`Title: ${this._tabSnapshot.title}`);
      content.push('Snapshot:');
      content.push(this._tabSnapshot.ariaSnapshot);
    }
    // Include console messages if available and expectation allows it
    if (
      this._tabSnapshot?.consoleMessages.length &&
      this._expectation.includeConsole
    ) {
      const filteredMessages = this.filterConsoleMessages(
        this._tabSnapshot.consoleMessages,
        this._expectation.consoleOptions
      );
      if (filteredMessages.length) {
        content.push('### Console Messages');
        for (const msg of filteredMessages) {
          content.push(`- ${msg.toString()}`);
        }
      }
    }
    return content.join('\n');
  }

  /**
   * Navigation retry configuration
   */
  private _getNavigationRetryConfig() {
    return {
      maxRetries: 3,
      retryDelay: 500,
      stabilityTimeout: 3000,
      evaluationTimeout: 200,
    };
  }

  /**
   * Captures snapshot with navigation detection and retry logic
   * Handles "Execution context was destroyed" errors gracefully
   */
  private async _captureSnapshotWithNavigationHandling(): Promise<void> {
    const currentTab = this._context.currentTabOrDie();
    const { maxRetries, retryDelay } = this._getNavigationRetryConfig();

    // Sequential retry attempts are intentional - we need to wait for each attempt
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // biome-ignore lint/nursery/noAwaitInLoop: Sequential retry logic is required
        await this._handleNavigationIfNeeded(currentTab, attempt, maxRetries);
        await this._attemptSnapshotCapture(currentTab);
        break; // Success - exit retry loop
      } catch (error: unknown) {
        const shouldRetry = await this._handleSnapshotError(
          error,
          attempt,
          maxRetries,
          retryDelay,
          currentTab
        );
        if (!shouldRetry) {
          break;
        }
      }
    }
  }

  private async _handleNavigationIfNeeded(
    tab: Tab,
    attempt: number,
    maxRetries: number
  ): Promise<void> {
    const isNavigating = await this._isPageNavigating(tab);
    if (isNavigating && attempt < maxRetries) {
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
    const errorMessage = (error as Error)?.message || '';
    const isContextError = this._isContextDestroyedError(errorMessage);

    if (isContextError && attempt < maxRetries) {
      await new Promise((resolve) => setTimeout(resolve, retryDelay * attempt));
      return true; // Continue retrying
    }

    if (attempt === maxRetries) {
      await this._handleFinalAttemptFailure(tab);
    }

    return false; // Stop retrying
  }

  private _isContextDestroyedError(errorMessage: string): boolean {
    return (
      errorMessage.includes('Execution context was destroyed') ||
      errorMessage.includes('Target closed') ||
      errorMessage.includes('Session closed')
    );
  }

  private async _handleFinalAttemptFailure(tab: Tab): Promise<void> {
    try {
      this._tabSnapshot = await this._captureBasicSnapshot(tab);
    } catch (error) {
      console.warn('Failed to capture basic snapshot:', error);
      this._tabSnapshot = undefined;
    }
  }

  /**
   * Checks if the page is currently navigating
   */
  private async _isPageNavigating(tab: Tab): Promise<boolean> {
    try {
      // Check Tab's internal navigation state if available
      if (
        'isNavigating' in tab &&
        typeof (tab as { isNavigating?: () => boolean }).isNavigating ===
          'function'
      ) {
        const tabNavigating = (
          tab as { isNavigating: () => boolean }
        ).isNavigating();
        if (tabNavigating) {
          return true;
        }
      }

      // Multiple checks for navigation state
      const [readyState, isLoading] = (await Promise.race([
        tab.page
          .evaluate(() => [
            document.readyState,
            (window as { performance?: { timing?: { loadEventEnd?: number } } })
              .performance?.timing?.loadEventEnd === 0,
          ])
          .catch(() => [null, null]),
        new Promise((resolve) =>
          setTimeout(
            () => resolve([null, null]),
            this._getNavigationRetryConfig().evaluationTimeout
          )
        ),
      ])) as [string | null, boolean | null];

      return readyState === 'loading' || isLoading === true;
    } catch (error) {
      // If we can't check, assume navigation might be happening
      console.debug('Navigation check failed (assuming in progress):', error);
      return true;
    }
  }

  /**
   * Waits for navigation to stabilize
   */
  private async _waitForNavigationStability(tab: Tab): Promise<void> {
    const stabilityTimeout = this._getNavigationRetryConfig().stabilityTimeout;
    const startTime = Date.now();

    // Use Tab's navigation completion method if available
    if (
      'waitForNavigationComplete' in tab &&
      typeof (tab as { waitForNavigationComplete?: () => Promise<void> })
        .waitForNavigationComplete === 'function'
    ) {
      try {
        await (
          tab as { waitForNavigationComplete: () => Promise<void> }
        ).waitForNavigationComplete();
        return;
      } catch (error) {
        // Fall through to manual detection
        console.debug('Tab navigation completion failed:', error);
      }
    }

    // Sequential waiting is intentional here - we need to check stability repeatedly
    while (Date.now() - startTime < stabilityTimeout) {
      try {
        // biome-ignore lint/nursery/noAwaitInLoop: Sequential stability checking is required
        await tab.waitForLoadState('load', { timeout: 1000 });
        await tab
          .waitForLoadState('networkidle', { timeout: 500 })
          .catch(() => {
            // Ignore network idle timeout
          });

        // Additional stability check
        const isStable = await tab.page
          .evaluate(() => document.readyState === 'complete')
          .catch(() => false);
        if (isStable) {
          // Small delay to ensure DOM is fully settled
          await new Promise((resolve) => setTimeout(resolve, 200));
          return;
        }
      } catch (error) {
        // Continue waiting
        console.debug('Page stability check failed (retrying):', error);
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  /**
   * Attempts to capture a basic snapshot with minimal requirements
   */
  private async _captureBasicSnapshot(tab: Tab): Promise<TabSnapshot> {
    try {
      // Try basic snapshot without complex operations
      return await tab.captureSnapshot();
    } catch (error) {
      // Create a minimal snapshot with available information
      console.warn(
        'Basic snapshot capture failed, creating minimal snapshot:',
        error
      );
      const url = tab.page.url();
      const title = await tab.page.title().catch(() => '');

      return {
        url,
        title,
        ariaSnapshot:
          '// Snapshot unavailable due to navigation context issues',
        modalStates: [],
        consoleMessages: [],
        downloads: [],
      };
    }
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
