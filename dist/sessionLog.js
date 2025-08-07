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
import { logUnhandledError } from './log.js';
import { outputFile } from './config.js';
export class SessionLog {
    _folder;
    _file;
    _ordinal = 0;
    _pendingEntries = [];
    _sessionFileQueue = Promise.resolve();
    _flushEntriesTimeout;
    constructor(sessionFolder) {
        this._folder = sessionFolder;
        this._file = path.join(this._folder, 'session.md');
    }
    static async create(config, rootPath) {
        const sessionFolder = await outputFile(config, rootPath, `session-${Date.now()}`);
        await fs.promises.mkdir(sessionFolder, { recursive: true });
        // eslint-disable-next-line no-console
        console.error(`Session: ${sessionFolder}`);
        return new SessionLog(sessionFolder);
    }
    logResponse(response) {
        const entry = {
            timestamp: performance.now(),
            toolCall: {
                toolName: response.toolName,
                toolArgs: response.toolArgs,
                result: response.result(),
                isError: response.isError(),
            },
            code: response.code(),
            tabSnapshot: response.tabSnapshot(),
        };
        this._appendEntry(entry);
    }
    logUserAction(action, tab, code, isUpdate) {
        code = code.trim();
        if (isUpdate) {
            const lastEntry = this._pendingEntries[this._pendingEntries.length - 1];
            if (lastEntry.userAction?.name === action.name) {
                lastEntry.userAction = action;
                lastEntry.code = code;
                return;
            }
        }
        if (action.name === 'navigate') {
            // Already logged at this location.
            const lastEntry = this._pendingEntries[this._pendingEntries.length - 1];
            if (lastEntry?.tabSnapshot?.url === action.url)
                return;
        }
        const entry = {
            timestamp: performance.now(),
            userAction: action,
            code,
            tabSnapshot: {
                url: tab.page.url(),
                title: '',
                ariaSnapshot: action.ariaSnapshot || '',
                modalStates: [],
                consoleMessages: [],
                downloads: [],
            },
        };
        this._appendEntry(entry);
    }
    _appendEntry(entry) {
        this._pendingEntries.push(entry);
        if (this._flushEntriesTimeout)
            clearTimeout(this._flushEntriesTimeout);
        this._flushEntriesTimeout = setTimeout(() => this._flushEntries(), 1000);
    }
    async _flushEntries() {
        clearTimeout(this._flushEntriesTimeout);
        const entries = this._pendingEntries;
        this._pendingEntries = [];
        const lines = [''];
        for (const entry of entries) {
            const ordinal = (++this._ordinal).toString().padStart(3, '0');
            if (entry.toolCall) {
                lines.push(`### Tool call: ${entry.toolCall.toolName}`, `- Args`, '```json', JSON.stringify(entry.toolCall.toolArgs, null, 2), '```');
                if (entry.toolCall.result) {
                    lines.push(entry.toolCall.isError ? `- Error` : `- Result`, '```', entry.toolCall.result, '```');
                }
            }
            if (entry.userAction) {
                const actionData = { ...entry.userAction };
                delete actionData.ariaSnapshot;
                delete actionData.selector;
                delete actionData.signals;
                lines.push(`### User action: ${entry.userAction.name}`, `- Args`, '```json', JSON.stringify(actionData, null, 2), '```');
            }
            if (entry.code) {
                lines.push(`- Code`, '```js', entry.code, '```');
            }
            if (entry.tabSnapshot) {
                const fileName = `${ordinal}.snapshot.yml`;
                fs.promises.writeFile(path.join(this._folder, fileName), entry.tabSnapshot.ariaSnapshot).catch(logUnhandledError);
                lines.push(`- Snapshot: ${fileName}`);
            }
            lines.push('', '');
        }
        this._sessionFileQueue = this._sessionFileQueue.then(() => fs.promises.appendFile(this._file, lines.join('\n')));
    }
}
