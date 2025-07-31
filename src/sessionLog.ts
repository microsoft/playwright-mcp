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
import path from 'path';

import { outputFile  } from './config.js';
import { Response } from './response.js';
import type { FullConfig } from './config.js';
import type * as actions from './actions.js';
import type { Tab } from './tab.js';

export type Action = actions.ActionInContext & { code: string; tab?: Tab | undefined; timestamp: number };

export class SessionLog {
  private _folder: string;
  private _file: string;
  private _ordinal = 0;
  private _lastModified = 0;

  constructor(sessionFolder: string) {
    this._folder = sessionFolder;
    this._file = path.join(this._folder, 'session.md');
  }

  static async create(config: FullConfig): Promise<SessionLog> {
    const sessionFolder = await outputFile(config, `session-${Date.now()}`);
    await fs.promises.mkdir(sessionFolder, { recursive: true });
    // eslint-disable-next-line no-console
    console.error(`Session: ${sessionFolder}`);
    return new SessionLog(sessionFolder);
  }

  lastModified() {
    return this._lastModified;
  }

  async logResponse(response: Response) {
    this._lastModified = performance.now();
    const prefix = `${(++this._ordinal).toString().padStart(3, '0')}`;
    const lines: string[] = [
      `### Tool call: ${response.toolName}`,
      `- Args`,
      '```json',
      JSON.stringify(response.toolArgs, null, 2),
      '```',
    ];
    if (response.result()) {
      lines.push(
          response.isError() ? `- Error` : `- Result`,
          '```',
          response.result(),
          '```');
    }

    if (response.code()) {
      lines.push(
          `- Code`,
          '```js',
          response.code(),
          '```');
    }

    const snapshot = await response.snapshot();
    if (snapshot?.tabSnapshot) {
      const fileName = `${prefix}.snapshot.yml`;
      await fs.promises.writeFile(path.join(this._folder, fileName), snapshot.tabSnapshot?.ariaSnapshot);
      lines.push(`- Snapshot: ${fileName}`);
    }

    for (const image of response.images()) {
      const fileName = `${prefix}.screenshot.${extension(image.contentType)}`;
      await fs.promises.writeFile(path.join(this._folder, fileName), image.data);
      lines.push(`- Screenshot: ${fileName}`);
    }

    lines.push('', '', '');
    await this._appendLines(lines);
  }

  async logActions(actions: Action[]) {
    // Skip recent navigation, it is a side-effect of the previous action or tool use.
    if (actions?.[0]?.action?.name === 'navigate' && actions[0].timestamp - this._lastModified < 1000)
      return;

    this._lastModified = performance.now();
    const lines: string[] = [];
    for (const action of actions) {
      const prefix = `${(++this._ordinal).toString().padStart(3, '0')}`;
      lines.push(
          `### User action: ${action.action.name}`,
      );
      if (action.code) {
        lines.push(
            `- Code`,
            '```js',
            action.code,
            '```');
      }
      if (action.action.ariaSnapshot) {
        const fileName = `${prefix}.snapshot.yml`;
        await fs.promises.writeFile(path.join(this._folder, fileName), action.action.ariaSnapshot);
        lines.push(`- Snapshot: ${fileName}`);
      }
      lines.push('', '', '');
    }

    await this._appendLines(lines);
  }

  private async _appendLines(lines: string[]) {
    await fs.promises.appendFile(this._file, lines.join('\n'));
  }
}

function extension(contentType: string): 'jpg' | 'png' {
  if (contentType === 'image/jpeg')
    return 'jpg';
  return 'png';
}
