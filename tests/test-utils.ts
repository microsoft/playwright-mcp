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

import fs from 'node:fs';
import path from 'node:path';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { expect } from './fixtures.js';

export const COMMON_REGEX_PATTERNS = {
  LISTENING_ON: /Listening on (http:\/\/.*)/,
  CREATE_SSE_SESSION: /create SSE session/,
  DELETE_SSE_SESSION: /delete SSE session/,
  CREATE_CONTEXT: /create context/,
  CLOSE_CONTEXT: /close context/,
  CREATE_BROWSER_CONTEXT_ISOLATED: /create browser context \(isolated\)/,
  CLOSE_BROWSER_CONTEXT_ISOLATED: /close browser context \(isolated\)/,
  OBTAIN_BROWSER_ISOLATED: /obtain browser \(isolated\)/,
  CLOSE_BROWSER_ISOLATED: /close browser \(isolated\)/,
  CREATE_BROWSER_CONTEXT_PERSISTENT: /create browser context \(persistent\)/,
  CLOSE_BROWSER_CONTEXT_PERSISTENT: /close browser context \(persistent\)/,
  LOCK_USER_DATA_DIR: /lock user data dir/,
  RELEASE_USER_DATA_DIR: /release user data dir/,
  MILLISECONDS: /\d{1,10}ms/u,
};

export interface TestPageContent {
  path: string;
  content: string;
  contentType: string;
}

export function createTestPage(
  content: string,
  title = 'Test Page'
): TestPageContent {
  return {
    path: '/',
    content: `<title>${title}</title>${content}`,
    contentType: 'text/html',
  };
}

export function createButtonPage(buttonText = 'Click Me'): TestPageContent {
  return createTestPage(`<button>${buttonText}</button>`);
}

export function createInputPage(inputId = 'input'): TestPageContent {
  return createTestPage(
    `<input id="${inputId}" type="text" /><button id="submit">Submit</button>`,
    'Input Page'
  );
}

export function expectBatchExecutionSuccess(
  result: any,
  expectedSteps: number
) {
  expect(result.content[0].text).toContain('Batch Execution Summary');
  expect(result.content[0].text).toContain('✅ Completed');
  expect(result.content[0].text).toContain(`Total Steps: ${expectedSteps}`);
  expect(result.content[0].text).toContain(`Successful: ${expectedSteps}`);
  expect(result.content[0].text).toContain('Failed: 0');
}

export function expectBatchExecutionPartialSuccess(
  result: any,
  totalSteps: number,
  successfulSteps: number,
  failedSteps: number
) {
  expect(result.content[0].text).toContain('Batch Execution Summary');
  expect(result.content[0].text).toContain(`Total Steps: ${totalSteps}`);
  expect(result.content[0].text).toContain(`Successful: ${successfulSteps}`);
  expect(result.content[0].text).toContain(`Failed: ${failedSteps}`);
}

export function expectToolCallResponse(
  result: any,
  options: {
    containsSnapshot?: boolean;
    containsConsole?: boolean;
    containsCode?: boolean;
    containsDownloads?: boolean;
    containsTabs?: boolean;
  }
) {
  const {
    containsSnapshot,
    containsConsole,
    containsCode,
    containsDownloads,
    containsTabs,
  } = options;

  if (containsSnapshot) {
    expect(result.content[0].text).toContain('Page Snapshot:');
  } else if (containsSnapshot === false) {
    expect(result.content[0].text).not.toContain('Page Snapshot:');
  }

  if (containsConsole) {
    expect(result.content[0].text).toContain('Console messages');
  } else if (containsConsole === false) {
    expect(result.content[0].text).not.toContain('Console messages');
  }

  if (containsCode) {
    expect(result.content[0].text).toContain('await page');
  } else if (containsCode === false) {
    expect(result.content[0].text).not.toContain('await page');
  }

  if (containsDownloads === false) {
    expect(result.content[0].text).not.toContain('Downloads');
  }

  if (containsTabs === false) {
    expect(result.content[0].text).not.toContain('Open tabs');
  }
}

export async function readSessionLog(sessionFolder: string): Promise<string> {
  return await fs.promises
    .readFile(path.join(sessionFolder, 'session.md'), 'utf8')
    .catch(() => '');
}

export function extractSessionFolder(stderr: string): string {
  const output = stderr
    .split('\n')
    .filter((line) => line.startsWith('Session: '))[0];
  return output.substring('Session: '.length);
}

export async function setupNavigateAndClick(
  client: Client,
  server: any,
  buttonText = 'Click Me'
) {
  const page = createButtonPage(buttonText);
  server.setContent(page.path, page.content, page.contentType);

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });
}

export function createMinimalExpectation() {
  return {
    includeSnapshot: false,
    includeConsole: false,
    includeDownloads: false,
    includeTabs: false,
    includeCode: false,
  };
}

export function createCodeOnlyExpectation() {
  return {
    ...createMinimalExpectation(),
    includeCode: true,
  };
}

export function createSnapshotExpectation() {
  return {
    ...createMinimalExpectation(),
    includeSnapshot: true,
    includeCode: true,
  };
}

export function createFullExpectation() {
  return {
    includeSnapshot: true,
    includeConsole: true,
    includeDownloads: true,
    includeTabs: true,
    includeCode: true,
  };
}

export function expectRegexMatch(text: string, regex: RegExp) {
  expect(text).toMatch(regex);
}

export function countRegexMatches(text: string, regex: RegExp): number {
  return (text.match(regex) || []).length;
}

export function expectRegexCount(
  text: string,
  regex: RegExp,
  expectedCount: number
) {
  expect(countRegexMatches(text, regex)).toBe(expectedCount);
}
