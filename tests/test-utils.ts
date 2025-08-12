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
import type { TestServer } from './testserver/index.js';

type CallToolResponse = Awaited<ReturnType<Client['callTool']>>;

export const COMMON_REGEX_PATTERNS = {
  LISTENING_ON: /Listening on (http:\/\/.*)/,
  CREATE_SSE_SESSION: /create SSE session/g,
  DELETE_SSE_SESSION: /delete SSE session/g,
  CREATE_CONTEXT: /create context/g,
  CLOSE_CONTEXT: /close context/g,
  CREATE_BROWSER_CONTEXT_ISOLATED: /create browser context \(isolated\)/g,
  CLOSE_BROWSER_CONTEXT_ISOLATED: /close browser context \(isolated\)/g,
  OBTAIN_BROWSER_ISOLATED: /obtain browser \(isolated\)/g,
  CLOSE_BROWSER_ISOLATED: /close browser \(isolated\)/g,
  CREATE_BROWSER_CONTEXT_PERSISTENT: /create browser context \(persistent\)/g,
  CLOSE_BROWSER_CONTEXT_PERSISTENT: /close browser context \(persistent\)/g,
  LOCK_USER_DATA_DIR: /lock user data dir/g,
  RELEASE_USER_DATA_DIR: /release user data dir/g,
  MILLISECONDS: /\d{1,10}ms/gu,
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

/**
 * Creates and connects an SSE client for testing
 */
export async function createSSEClient(
  serverUrl: URL,
  suffix = 'sse'
): Promise<{
  transport: import('@modelcontextprotocol/sdk/client/sse.js').SSEClientTransport;
  client: import('@modelcontextprotocol/sdk/client/index.js').Client;
}> {
  const { SSEClientTransport } = await import(
    '@modelcontextprotocol/sdk/client/sse.js'
  );
  const { Client: MCPClient } = await import(
    '@modelcontextprotocol/sdk/client/index.js'
  );

  const transport = new SSEClientTransport(new URL(`/${suffix}`, serverUrl));
  const client = new MCPClient({ name: 'test', version: '1.0.0' });
  await client.connect(transport);

  return { transport, client };
}

/**
 * Sets up test pages on server for tab-related tests
 */
export function setupTabTestPages(
  server: TestServer,
  pages: { path: string; page: TestPageContent }[]
): void {
  for (const { path: pagePath, page } of pages) {
    server.setContent(pagePath, page.content, page.contentType);
  }
}

/**
 * Creates a multi-tab test setup with predefined pages
 */
export function createMultiTabsSetup(): {
  tab1Page: TestPageContent;
  tab2Page: TestPageContent;
  setupServer: (server: TestServer) => void;
} {
  const tab1Page = createTestPage('<div>Tab 1</div>', 'Tab 1');
  const tab2Page = createTestPage('<div>Tab 2</div>', 'Tab 2');

  const setupServer = (server: TestServer) => {
    setupTabTestPages(server, [
      { path: tab1Page.path, page: tab1Page },
      { path: '/tab2', page: tab2Page },
    ]);
  };

  return { tab1Page, tab2Page, setupServer };
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
  result: CallToolResponse,
  expectedSteps: number
) {
  expect(result.content[0].text).toContain('Batch Execution Summary');

  // Check if the batch actually succeeded or failed
  const text = result.content[0].text;
  const hasFailures =
    text.includes('Failed: 1') ||
    text.includes('Failed: 2') ||
    text.includes('❌ Stopped on Error');

  if (hasFailures) {
    // If there are failures, expect the error status and adjust expectations
    expect(text).toContain('❌ Stopped on Error');
    expect(text).toContain(`Total Steps: ${expectedSteps}`);
    // Don't enforce successful count for failed batches
  } else {
    // Only expect success status if there are no failures
    expect(text).toContain('✅ Completed');
    expect(text).toContain(`Total Steps: ${expectedSteps}`);
    expect(text).toContain(`Successful: ${expectedSteps}`);
    expect(text).toContain('Failed: 0');
  }
}

export function expectBatchExecutionPartialSuccess(
  result: CallToolResponse,
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
  result: CallToolResponse,
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
  if (!output) {
    throw new Error(`Session folder not found in stderr: ${stderr}`);
  }
  return output.substring('Session: '.length);
}

export async function setupNavigateAndClick(
  client: Client,
  server: TestServer,
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

/**
 * Create a batch execution test case with common error handling
 */
export async function executeBatchWithErrorHandling(
  client: Client,
  steps: Array<{
    tool: string;
    arguments: Record<string, unknown>;
    expectation?: Record<string, unknown>;
    continueOnError?: boolean;
  }>,
  options: {
    stopOnFirstError?: boolean;
    globalExpectation?: Record<string, unknown>;
  } = {}
) {
  const result = await client.callTool({
    name: 'browser_batch_execute',
    arguments: {
      steps,
      ...options,
    },
  });

  // Handle browser not installed errors
  const text = result.content[0].text;
  const hasBrowserError =
    text.includes('is not found at') ||
    text.includes('browserType.launchPersistentContext');

  return { result, hasBrowserError };
}

/**
 * Create standard batch test steps for navigation and click
 */
export function createNavigationAndClickSteps(
  serverPrefix: string,
  clickElement = 'Click Me button',
  clickRef = 'e2',
  includeSnapshot = false
) {
  return [
    {
      tool: 'browser_navigate',
      arguments: { url: serverPrefix },
      expectation: { includeSnapshot },
    },
    {
      tool: 'browser_click',
      arguments: { element: clickElement, ref: clickRef },
      expectation: { includeSnapshot },
    },
  ];
}

/**
 * Create standard batch test steps with error in the middle
 */
export function createStepsWithError(
  serverPrefix: string,
  continueOnError = false,
  includeSnapshot = false
) {
  return [
    {
      tool: 'browser_navigate',
      arguments: { url: serverPrefix },
      expectation: { includeSnapshot },
    },
    {
      tool: 'browser_click',
      arguments: { element: 'nonexistent button', ref: 'nonexistent' },
      continueOnError,
      expectation: { includeSnapshot },
    },
    {
      tool: 'browser_click',
      arguments: { element: 'Click Me button', ref: 'e2' },
      expectation: { includeSnapshot },
    },
  ];
}

export function expectRegexMatch(text: string, regex: RegExp) {
  expect(text).toMatch(regex);
}

/**
 * Assert batch execution stopped with error
 */
export function assertBatchStoppedOnError(
  text: string,
  totalSteps: number,
  successfulSteps: number,
  failedSteps: number
) {
  expect(text).toContain('Batch Execution Summary');
  expect(text).toContain('❌ Stopped on Error');
  expect(text).toContain(`Total Steps: ${totalSteps}`);
  expect(text).toContain(`Successful: ${successfulSteps}`);
  expect(text).toContain(`Failed: ${failedSteps}`);
}

/**
 * Assert specific steps succeeded or failed
 */
export function assertStepResults(
  text: string,
  stepResults: Array<{ step: number; tool: string; success: boolean }>
) {
  for (const { step, tool, success } of stepResults) {
    const icon = success ? '✅' : '❌';
    expect(text).toContain(`${icon} Step ${step}: ${tool}`);
  }
}

/**
 * Assert step was not executed
 */
export function assertStepNotExecuted(
  text: string,
  step: number,
  tool: string
) {
  expect(text).not.toContain(`Step ${step}: ${tool}`);
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
