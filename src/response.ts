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

import { renderModalStates } from './tab.js';
import { mergeExpectations } from './schemas/expectation.js';
import { processImage } from './utils/imageProcessor.js';

import type { Tab, TabSnapshot } from './tab.js';
import type { ImageContent, TextContent } from '@modelcontextprotocol/sdk/types.js';
import type { Context } from './context.js';
import type { ExpectationOptions } from './schemas/expectation.js';

export class Response {
  private _result: string[] = [];
  private _code: string[] = [];
  private _images: { contentType: string, data: Buffer }[] = [];
  private _context: Context;
  private _includeSnapshot = false;
  private _includeTabs = false;
  private _tabSnapshot: TabSnapshot | undefined;
  private _expectation: NonNullable<ExpectationOptions>;

  readonly toolName: string;
  readonly toolArgs: Record<string, any>;
  private _isError: boolean | undefined;

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
      const options = this._expectation.snapshotOptions;
      if (options?.selector || options?.maxLength) {
        // Use partial snapshot capture when selector or maxLength is specified
        this._tabSnapshot = await this._context.currentTabOrDie().capturePartialSnapshot(
            options.selector,
            options.maxLength
        );
      } else {
        this._tabSnapshot = await this._context.currentTabOrDie().captureSnapshot();
      }
    }
    for (const tab of this._context.tabs())
      await tab.updateTitle();
  }

  tabSnapshot(): TabSnapshot | undefined {
    return this._tabSnapshot;
  }

  async serialize(): Promise<{ content: (TextContent | ImageContent)[], isError?: boolean }> {
    const response: string[] = [];

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
    const shouldIncludeTabs = this._expectation.includeTabs;
    const shouldIncludeSnapshot = this._expectation.includeSnapshot || this._includeSnapshot;

    if (shouldIncludeTabs)
      response.push(...renderTabsMarkdown(this._context.tabs(), shouldIncludeTabs));

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

    // Image attachments with optional processing.
    if (this._context.config.imageResponses !== 'omit') {
      for (const image of this._images) {
        let processedImage = image;
        
        // Apply Sharp processing if imageOptions are specified
        if (this._expectation.imageOptions) {
          try {
            processedImage = await processImage(
              image.data,
              image.contentType,
              this._expectation.imageOptions
            );
          } catch (error) {
            // If Sharp processing fails, use original image
            console.error('Image processing failed:', error);
            processedImage = image;
          }
        }
        
        content.push({ 
          type: 'image', 
          data: processedImage.data.toString('base64'), 
          mimeType: processedImage.contentType 
        });
      }
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
    lines.push(`- Page Snapshot:`);
    lines.push('```yaml');

    // Use the snapshot as-is (length restrictions handled in tab.ts)
    const snapshot = tabSnapshot.ariaSnapshot;

    lines.push(snapshot);
    lines.push('```');

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
}

function renderTabSnapshot(tabSnapshot: TabSnapshot): string {
  const lines: string[] = [];

  if (tabSnapshot.consoleMessages.length) {
    lines.push(`### New console messages`);
    for (const message of tabSnapshot.consoleMessages)
      lines.push(`- ${trim(message.toString(), 100)}`);
    lines.push('');
  }

  if (tabSnapshot.downloads.length) {
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
  lines.push(`- Page Snapshot:`);
  lines.push('```yaml');
  lines.push(tabSnapshot.ariaSnapshot);
  lines.push('```');

  return lines.join('\n');
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
