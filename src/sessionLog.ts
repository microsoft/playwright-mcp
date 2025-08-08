// @ts-nocheck
import fs from 'node:fs';
import path from 'node:path';
import type * as actions from './actions.js';
import type { FullConfig } from './config.js';
import { outputFile } from './config.js';
import { logUnhandledError } from './log.js';
import type { Response } from './response.js';
import type { Tab, TabSnapshot } from './tab.js';

type LogEntry = {
  timestamp: number;
  toolCall?: {
    toolName: string;
    toolArgs: Record<string, unknown>;
    result: string;
    isError?: boolean;
  };
  userAction?: actions.Action;
  code: string;
  tabSnapshot?: TabSnapshot;
};
export class SessionLog {
  private _folder: string;
  private _file: string;
  private _pendingEntries: LogEntry[] = [];
  private _sessionFileQueue = Promise.resolve();
  private _flushEntriesTimeout: NodeJS.Timeout | undefined;
  constructor(sessionFolder: string) {
    this._folder = sessionFolder;
    this._file = path.join(this._folder, 'session.md');
  }
  static async create(
    config: FullConfig,
    rootPath: string | undefined
  ): Promise<SessionLog> {
    const sessionFolder = await outputFile(
      config,
      rootPath,
      `session-${Date.now()}`
    );
    await fs.promises.mkdir(sessionFolder, { recursive: true });

    return new SessionLog(sessionFolder);
  }
  logResponse(response: Response) {
    const entry: LogEntry = {
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
  logUserAction(
    action: actions.Action,
    tab: Tab,
    code: string,
    isUpdate: boolean
  ) {
    code = code.trim();
    if (isUpdate) {
      const lastEntry = this._pendingEntries.at(-1);
      if (lastEntry.userAction?.name === action.name) {
        lastEntry.userAction = action;
        lastEntry.code = code;
        return;
      }
    }
    if (action.name === 'navigate') {
      // Already logged at this location.
      const lastEntry = this._pendingEntries.at(-1);
      if (lastEntry?.tabSnapshot?.url === action.url) {
        return;
      }
    }
    const entry: LogEntry = {
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
  private _appendEntry(entry: LogEntry) {
    this._pendingEntries.push(entry);
    if (this._flushEntriesTimeout) {
      clearTimeout(this._flushEntriesTimeout);
    }
    this._flushEntriesTimeout = setTimeout(() => this._flushEntries(), 1000);
  }
  private async _flushEntries() {
    clearTimeout(this._flushEntriesTimeout);
    const entries = this._pendingEntries;
    this._pendingEntries = [];
    const lines: string[] = [''];
    for (const entry of entries) {
      const ordinal = (++this._ordinal).toString().padStart(3, '0');
      if (entry.toolCall) {
        lines.push(
          `### Tool call: ${entry.toolCall.toolName}`,
          '- Args',
          '```json',
          JSON.stringify(entry.toolCall.toolArgs, null, 2),
          '```'
        );
        if (entry.toolCall.result) {
          lines.push(
            entry.toolCall.isError ? '- Error' : '- Result',
            '```',
            entry.toolCall.result,
            '```'
          );
        }
      }
      if (entry.userAction) {
        const actionData = { ...entry.userAction } as Record<string, unknown>;
        actionData.ariaSnapshot = undefined;
        actionData.selector = undefined;
        actionData.signals = undefined;
        lines.push(
          `### User action: ${entry.userAction.name}`,
          '- Args',
          '```json',
          JSON.stringify(actionData, null, 2),
          '```'
        );
      }
      if (entry.code) {
        lines.push('- Code', '```js', entry.code, '```');
      }
      if (entry.tabSnapshot) {
        const fileName = `${ordinal}.snapshot.yml`;
        fs.promises
          .writeFile(
            path.join(this._folder, fileName),
            entry.tabSnapshot.ariaSnapshot
          )
          .catch(logUnhandledError);
        lines.push(`- Snapshot: ${fileName}`);
      }
      lines.push('', '');
    }
    this._sessionFileQueue = this._sessionFileQueue.then(() =>
      fs.promises.appendFile(this._file, lines.join('\n'))
    );
  }
}
