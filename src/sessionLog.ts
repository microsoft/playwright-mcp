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
  private readonly _folder: string;
  private readonly _file: string;
  private _pendingEntries: LogEntry[] = [];
  private _sessionFileQueue = Promise.resolve();
  private _flushEntriesTimeout: NodeJS.Timeout | undefined;
  // biome-ignore lint/correctness/noUnusedPrivateClassMembers: _ordinal is used in _flush method line 111
  private _ordinal = 0;
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
    const trimmedCode = code.trim();

    if (this._shouldUpdateExistingEntry(action, isUpdate, trimmedCode)) {
      return;
    }

    if (this._shouldSkipDuplicateNavigation(action)) {
      return;
    }

    const entry = this._createUserActionEntry(action, tab, trimmedCode);
    this._appendEntry(entry);
  }

  private _shouldUpdateExistingEntry(
    action: actions.Action,
    isUpdate: boolean,
    trimmedCode: string
  ): boolean {
    if (!isUpdate) {
      return false;
    }

    const lastEntry = this._pendingEntries.at(-1);
    if (lastEntry?.userAction?.name === action.name) {
      lastEntry.userAction = action;
      lastEntry.code = trimmedCode;
      return true;
    }

    return false;
  }

  private _shouldSkipDuplicateNavigation(action: actions.Action): boolean {
    if (action.name !== 'navigate') {
      return false;
    }

    const lastEntry = this._pendingEntries.at(-1);
    return lastEntry?.tabSnapshot?.url === action.url;
  }

  private _createUserActionEntry(
    action: actions.Action,
    tab: Tab,
    trimmedCode: string
  ): LogEntry {
    return {
      timestamp: performance.now(),
      userAction: action,
      code: trimmedCode,
      tabSnapshot: {
        url: tab.page.url(),
        title: '',
        ariaSnapshot: action.ariaSnapshot ?? '',
        modalStates: [],
        consoleMessages: [],
        downloads: [],
      },
    };
  }
  private _appendEntry(entry: LogEntry) {
    this._pendingEntries.push(entry);
    if (this._flushEntriesTimeout) {
      clearTimeout(this._flushEntriesTimeout);
    }
    this._flushEntriesTimeout = setTimeout(() => this._flushEntries(), 1000);
  }
  private _flushEntries() {
    clearTimeout(this._flushEntriesTimeout);
    const entries = this._pendingEntries;
    this._pendingEntries = [];
    const lines: string[] = [''];

    for (const entry of entries) {
      const ordinal = (++this._ordinal).toString().padStart(3, '0');
      this._processEntry(entry, ordinal, lines);
    }

    this._sessionFileQueue = this._sessionFileQueue.then(() =>
      fs.promises.appendFile(this._file, lines.join('\n'))
    );
  }

  private _processEntry(
    entry: LogEntry,
    ordinal: string,
    lines: string[]
  ): void {
    if (entry.toolCall) {
      this._addToolCallLines(entry.toolCall, lines);
    }

    if (entry.userAction) {
      this._addUserActionLines(entry.userAction, lines);
    }

    if (entry.code) {
      lines.push('- Code', '```js', entry.code, '```');
    }

    if (entry.tabSnapshot) {
      this._addTabSnapshotLines(entry.tabSnapshot, ordinal, lines);
    }

    lines.push('', '');
  }

  private _addToolCallLines(
    toolCall: NonNullable<LogEntry['toolCall']>,
    lines: string[]
  ): void {
    lines.push(
      `### Tool call: ${toolCall.toolName}`,
      '- Args',
      '```json',
      JSON.stringify(toolCall.toolArgs, null, 2),
      '```'
    );

    if (toolCall.result) {
      lines.push(
        toolCall.isError ? '- Error' : '- Result',
        '```',
        toolCall.result,
        '```'
      );
    }
  }

  private _addUserActionLines(
    userAction: actions.Action,
    lines: string[]
  ): void {
    const actionData = { ...userAction } as Record<string, unknown>;
    actionData.ariaSnapshot = undefined;
    actionData.selector = undefined;
    actionData.signals = undefined;

    lines.push(
      `### User action: ${userAction.name}`,
      '- Args',
      '```json',
      JSON.stringify(actionData, null, 2),
      '```'
    );
  }

  private _addTabSnapshotLines(
    tabSnapshot: TabSnapshot,
    ordinal: string,
    lines: string[]
  ): void {
    const fileName = `${ordinal}.snapshot.yml`;
    fs.promises
      .writeFile(path.join(this._folder, fileName), tabSnapshot.ariaSnapshot)
      .catch(logUnhandledError);
    lines.push(`- Snapshot: ${fileName}`);
  }
}
