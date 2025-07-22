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

import type { ImageContent, TextContent } from '@modelcontextprotocol/sdk/types.js';
import type { Context } from './context.js';

export class Response {
  private _result: string[] = [];
  private _code: string[] = [];
  private _images: { contentType: string, data: Buffer }[] = [];
  private _context: Context;
  private _includeSnapshot = false;
  private _snapshot: string | undefined;
  private _includeTabs = false;

  constructor(context: Context) {
    this._context = context;
  }

  addResult(result: string) {
    this._result.push(result);
  }

  addCode(code: string) {
    this._code.push(code);
  }

  addImage(image: { contentType: string, data: Buffer }) {
    this._images.push(image);
  }

  setIncludeSnapshot() {
    this._includeSnapshot = true;
  }

  setIncludeTabs() {
    this._includeTabs = true;
  }

  includeSnapshot() {
    return this._includeSnapshot;
  }

  addSnapshot(snapshot: string) {
    this._snapshot = snapshot;
  }

  async serialize(): Promise<{ content: (TextContent | ImageContent)[] }> {
    const response: string[] = [];

    // Start with command result.
    if (this._result.length) {
      response.push('### Result');
      response.push(this._result.join('\n'));
      response.push('');
    }

    // Add code if it exists.
    if (this._code.length) {
      response.push(`### Ran Playwright code
\`\`\`js
${this._code.join('\n')}
\`\`\``);
      response.push('');
    }

    // List browser tabs.
    if (this._includeSnapshot || this._includeTabs)
      response.push(...(await this._context.listTabsMarkdown(this._includeTabs)));

    // Add snapshot if provided.
    if (this._snapshot)
      response.push(this._snapshot, '');

    // Main response part
    const content: (TextContent | ImageContent)[] = [
      { type: 'text', text: response.join('\n') },
    ];

    // Image attachments.
    if (this._context.config.imageResponses !== 'omit') {
      for (const image of this._images)
        content.push({ type: 'image', data: image.data.toString('base64'), mimeType: image.contentType });
    }

    return { content };
  }
}
