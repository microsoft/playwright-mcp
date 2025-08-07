import { renderModalStates } from './tab.js';
import { mergeExpectations } from './schemas/expectation.js';
import { processImage } from './utils/imageProcessor.js';
import { ResponseDiffDetector } from './utils/responseDiffDetector.js';
import type { Tab, TabSnapshot } from './tab.js';
import type { ImageContent, TextContent } from '@modelcontextprotocol/sdk/types.js';
import type { Context } from './context.js';
import type { ExpectationOptions } from './schemas/expectation.js';
import type { DiffResult } from './types/diff.js';
export class Response {
  private _result: string[] = [];
  private _code: string[] = [];
  private _images: { contentType: string, data: Buffer }[] = [];
  private _context: Context;
  private _includeSnapshot = false;
  private _includeTabs = false;
  private _tabSnapshot: TabSnapshot | undefined;
  private _expectation: NonNullable<ExpectationOptions>;
  private _diffResult: DiffResult | undefined;
  readonly toolName: string;
  readonly toolArgs: Record<string, any>;
  private _isError: boolean | undefined;
  // Static diff detector instance shared across all responses
  private static diffDetector: ResponseDiffDetector = new ResponseDiffDetector();
  constructor(context: Context, toolName: string, toolArgs: Record<string, any>, expectation?: ExpectationOptions) {
    this._context = context;
    this.toolName = toolName;
    this.toolArgs = toolArgs;
    // Use expectation from toolArgs if not provided directly
    const actualExpectation = expectation || toolArgs.expectation;
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
  addImage(image: { contentType: string, data: Buffer }) {
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
  async finish() {
    // All the async snapshotting post-action is happening here.
    // Everything below should race against modal states.
    // Expectation settings take priority over legacy setIncludeSnapshot calls
    const shouldIncludeSnapshot = this._expectation.includeSnapshot || this._includeSnapshot;
    if (shouldIncludeSnapshot && this._context.currentTab()) {
      // Enhanced navigation detection and deferred execution
      await this._captureSnapshotWithNavigationHandling();
    }
    for (const tab of this._context.tabs())
      await tab.updateTitle();
    // Process images if image options are specified
    if (this._expectation.imageOptions && this._images.length > 0) {
      const processedImages = [];
      for (const image of this._images) {
        try {
          const processedResult = await processImage(
              image.data,
              image.contentType,
              this._expectation.imageOptions
          );
          processedImages.push({
            contentType: processedResult.contentType,
            data: processedResult.data
          });
        } catch (error) {
          // If processing fails, keep the original image
          // TODO: Use proper logging instead of console

          // Image processing failed
          processedImages.push(image);
        }
      }
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
          ignoreWhitespace: this._expectation.diffOptions.ignoreWhitespace ?? true,
          context: this._expectation.diffOptions.context ?? 3
        };
        this._diffResult = await Response.diffDetector.detectDiff(
            currentContent,
            this.toolName,
            diffOptions
        );
      } catch (error) {
        // Gracefully handle diff detection errors
        // TODO: Use proper logging instead of console

        // Diff detection failed
        this._diffResult = undefined;
      }
    }
  }
  tabSnapshot(): TabSnapshot | undefined {
    return this._tabSnapshot;
  }
  serialize(): { content: (TextContent | ImageContent)[], isError?: boolean } {
    const response: string[] = [];
    // Add diff information if available and has differences
    if (this._diffResult?.hasDifference && this._diffResult.formattedDiff) {
      response.push('### Changes from previous response');
      response.push(`Similarity: ${(this._diffResult.similarity * 100).toFixed(1)}%`);
      response.push(`Changes: ${this._diffResult.metadata.addedLines} additions, ${this._diffResult.metadata.removedLines} deletions`);
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
    const shouldIncludeTabs = this._expectation.includeTabs || this._includeTabs;
    const shouldIncludeSnapshot = this._expectation.includeSnapshot || this._includeSnapshot;
    if (shouldIncludeTabs) {
      const tabsMarkdown = renderTabsMarkdown(this._context.tabs(), true);
      response.push(...tabsMarkdown);
    }
    // Add snapshot if provided and expectation allows it.
    if (shouldIncludeSnapshot && this._tabSnapshot?.modalStates.length) {
      response.push(...renderModalStates(this._context, this._tabSnapshot.modalStates));
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
      for (const image of this._images)
        content.push({ type: 'image', data: image.data.toString('base64'), mimeType: image.contentType });
    }
    return { content, isError: this._isError };
  }
  private renderFilteredTabSnapshot(tabSnapshot: TabSnapshot): string {
    const lines: string[] = [];
    const consoleOptions = this._expectation.consoleOptions;
    // Include console messages based on expectation
    if (this._expectation.includeConsole && tabSnapshot.consoleMessages.length) {
      const filteredMessages = this.filterConsoleMessages(tabSnapshot.consoleMessages, consoleOptions);
      if (filteredMessages.length) {
        lines.push(`### New console messages`);
        for (const message of filteredMessages)
          lines.push(`- ${trim(message.toString(), 100)}`);
        lines.push('');
      }
    }
    // Include downloads based on expectation
    if (this._expectation.includeDownloads && tabSnapshot.downloads.length) {
      lines.push(`### Downloads`);
      for (const entry of tabSnapshot.downloads) {
        if (entry.finished)
          lines.push(`- Downloaded file ${entry.download.suggestedFilename()} to ${entry.outputFile}`);
        else
          lines.push(`- Downloading file ${entry.download.suggestedFilename()} ...`);
      }
      lines.push('');
    }
    lines.push(`### Page state`);
    lines.push(`- Page URL: ${tabSnapshot.url}`);
    lines.push(`- Page Title: ${tabSnapshot.title}`);
    // Only include snapshot if expectation allows it
    if (this._expectation.includeSnapshot) {
      lines.push(`- Page Snapshot:`);
      lines.push('```yaml');
      // Use the snapshot as-is (length restrictions handled in tab.ts)
      const snapshot = tabSnapshot.ariaSnapshot;
      lines.push(snapshot);
      lines.push('```');
    }
    return lines.join('\n');
  }
  private filterConsoleMessages(messages: any[], options?: NonNullable<ExpectationOptions>['consoleOptions']): any[] {
    let filtered = messages;
    // Filter by levels if specified
    if (options?.levels && options.levels.length > 0) {
      filtered = filtered.filter(msg => {
        const level = msg.type || 'log';
        return options.levels!.includes(level);
      });
    }
    // Limit number of messages
    const maxMessages = options?.maxMessages ?? 10;
    if (filtered.length > maxMessages)
      filtered = filtered.slice(0, maxMessages);
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
    if (this._tabSnapshot?.consoleMessages.length && this._expectation.includeConsole) {
      const filteredMessages = this.filterConsoleMessages(
          this._tabSnapshot.consoleMessages,
          this._expectation.consoleOptions
      );
      if (filteredMessages.length) {
        content.push('### Console Messages');
        filteredMessages.forEach(msg => content.push(`- ${msg.toString()}`));
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
      evaluationTimeout: 200
    };
  }

  /**
   * Captures snapshot with navigation detection and retry logic
   * Handles "Execution context was destroyed" errors gracefully
   */
  private async _captureSnapshotWithNavigationHandling(): Promise<void> {
    const currentTab = this._context.currentTabOrDie();
    const options = this._expectation.snapshotOptions;
    const maxRetries = this._getNavigationRetryConfig().maxRetries;
    const retryDelay = this._getNavigationRetryConfig().retryDelay;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Check if navigation is in progress
        const isNavigating = await this._isPageNavigating(currentTab);

        if (isNavigating && attempt < maxRetries) {
          // Wait for navigation to complete before snapshot
          await this._waitForNavigationStability(currentTab);
        }

        // Attempt snapshot capture
        if (options?.selector || options?.maxLength) {
          this._tabSnapshot = await currentTab.capturePartialSnapshot(
              options.selector,
              options.maxLength
          );
        } else {
          this._tabSnapshot = await currentTab.captureSnapshot();
        }

        // Success - break out of retry loop
        break;

      } catch (error: any) {
        const errorMessage = error?.message || '';
        const isContextError = errorMessage.includes('Execution context was destroyed') ||
                               errorMessage.includes('Target closed') ||
                               errorMessage.includes('Session closed');

        if (isContextError && attempt < maxRetries) {
          // Wait for stability and retry
          await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
          continue;
        }

        if (attempt === maxRetries) {
          // Last attempt failed - try to capture basic snapshot or give up gracefully
          try {
            this._tabSnapshot = await this._captureBasicSnapshot(currentTab);
          } catch (finalError) {
            // Could not capture snapshot - log error but don't throw
            // Failed to capture snapshot after navigation
            this._tabSnapshot = undefined;
          }
        }
      }
    }
  }

  /**
   * Checks if the page is currently navigating
   */
  private async _isPageNavigating(tab: Tab): Promise<boolean> {
    try {
      // Check Tab's internal navigation state if available
      if ('isNavigating' in tab && typeof (tab as any).isNavigating === 'function') {
        const tabNavigating = (tab as any).isNavigating();
        if (tabNavigating)
          return true;
      }

      // Multiple checks for navigation state
      const [readyState, isLoading] = await Promise.race([
        tab.page.evaluate(() => [
          document.readyState,
          (window as any).performance?.timing?.loadEventEnd === 0
        ]).catch(() => [null, null]),
        new Promise(resolve => setTimeout(() => resolve([null, null]), this._getNavigationRetryConfig().evaluationTimeout))
      ]) as [string | null, boolean | null];

      return readyState === 'loading' || isLoading === true;
    } catch (error) {
      // If we can't check, assume navigation might be happening
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
    if ('waitForNavigationComplete' in tab && typeof (tab as any).waitForNavigationComplete === 'function') {
      try {
        await (tab as any).waitForNavigationComplete();
        return;
      } catch (error) {
        // Fall through to manual detection
      }
    }

    while (Date.now() - startTime < stabilityTimeout) {
      try {
        await tab.waitForLoadState('load', { timeout: 1000 });
        await tab.waitForLoadState('networkidle', { timeout: 500 }).catch(() => {});

        // Additional stability check
        const isStable = await tab.page.evaluate(() => document.readyState === 'complete').catch(() => false);
        if (isStable) {
          // Small delay to ensure DOM is fully settled
          await new Promise(resolve => setTimeout(resolve, 200));
          return;
        }
      } catch (error) {
        // Continue waiting
      }

      await new Promise(resolve => setTimeout(resolve, 100));
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
      const url = tab.page.url();
      const title = await tab.page.title().catch(() => '');

      return {
        url,
        title,
        ariaSnapshot: '// Snapshot unavailable due to navigation context issues',
        modalStates: [],
        consoleMessages: [],
        downloads: []
      };
    }
  }
}
function renderTabsMarkdown(tabs: Tab[], force: boolean = false): string[] {
  if (tabs.length === 1 && !force)
    return [];
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
  if (text.length <= maxLength)
    return text;
  return text.slice(0, maxLength) + '...';
}
