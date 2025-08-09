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

/**
 * Common test utilities and helpers to reduce code duplication
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { expect } from '@playwright/test';
import type { Page } from 'playwright';
import { DiagnosticThresholds } from '../src/diagnostics/diagnostic-thresholds.js';
import type { SearchCriteria } from '../src/diagnostics/element-discovery.js';
import { SmartConfigManager } from '../src/diagnostics/smart-config.js';
import { Tab } from '../src/tab.js';
import type { TestServer } from './testserver/index.js';

type CallToolResponse = Awaited<ReturnType<Client['callTool']>>;
type MockElement = { [key: string]: unknown };
type MockPage = { [key: string]: unknown };
type MockContext = { [key: string]: unknown };

export type ConsoleMethod = 'log' | 'info' | 'warn' | 'error';

/**
 * Console capture utility for testing
 */
export class ConsoleCapture {
  private originalMethods: Map<ConsoleMethod, (...args: unknown[]) => void> =
    new Map();
  private capturedMessages: Array<{ level: ConsoleMethod; args: unknown[] }> =
    [];

  /**
   * Start capturing console output for specified methods
   */
  start(methods: ConsoleMethod[] = ['warn', 'error', 'info']): void {
    for (const method of methods) {
      const consoleObject = console as Record<
        ConsoleMethod,
        (...args: unknown[]) => void
      >;
      this.originalMethods.set(method, consoleObject[method]);
      consoleObject[method] = (...args: unknown[]) => {
        this.capturedMessages.push({ level: method, args });
        // Optionally call original method for debugging
        // this.originalMethods.get(method)?.(...args);
      };
    }
  }

  /**
   * Stop capturing and restore original console methods
   */
  stop(): void {
    for (const [method, originalMethod] of this.originalMethods) {
      console[method] = originalMethod;
    }
    this.originalMethods.clear();
  }

  /**
   * Get all captured messages
   */
  getMessages(): Array<{ level: ConsoleMethod; args: unknown[] }> {
    return [...this.capturedMessages];
  }

  /**
   * Get messages for a specific level
   */
  getMessagesForLevel(level: ConsoleMethod): unknown[][] {
    return this.capturedMessages
      .filter((msg) => msg.level === level)
      .map((msg) => msg.args);
  }

  /**
   * Get warn messages (backward compatibility)
   */
  getWarnCalls(): unknown[][] {
    return this.getMessagesForLevel('warn');
  }

  /**
   * Check if any message contains specific text
   */
  hasMessageContaining(text: string, level?: ConsoleMethod): boolean {
    const messages = level
      ? this.getMessagesForLevel(level)
      : this.capturedMessages;

    return messages.some((msg) =>
      Array.isArray(msg)
        ? msg.some((arg) => String(arg).includes(text))
        : msg.args.some((arg) => String(arg).includes(text))
    );
  }

  /**
   * Clear captured messages
   */
  clear(): void {
    this.capturedMessages.length = 0;
  }

  /**
   * Get message count for a specific level
   */
  getMessageCount(level?: ConsoleMethod): number {
    if (!level) {
      return this.capturedMessages.length;
    }
    return this.capturedMessages.filter((msg) => msg.level === level).length;
  }
}

/**
 * Test setup utilities for diagnostic components
 */
export class DiagnosticTestSetup {
  private consoleCapture: ConsoleCapture = new ConsoleCapture();

  /**
   * Setup before each test - resets diagnostic components and starts console capture
   */
  beforeEach(
    captureConsole = true,
    consoleMethods?: ConsoleMethod[]
  ): ConsoleCapture {
    // Reset DiagnosticThresholds
    DiagnosticThresholds.reset();

    // Reset SmartConfigManager
    (SmartConfigManager as { instance: null }).instance = null;

    // Start console capture if requested
    if (captureConsole) {
      this.consoleCapture.start(consoleMethods);
    }

    return this.consoleCapture;
  }

  /**
   * Cleanup after each test
   */
  afterEach(): void {
    this.consoleCapture.stop();
    this.consoleCapture.clear();

    // Reset instances
    DiagnosticThresholds.reset();
    (SmartConfigManager as { instance: null }).instance = null;
  }

  /**
   * Get console capture instance
   */
  getConsoleCapture(): ConsoleCapture {
    return this.consoleCapture;
  }
}

/**
 * Create a mock element with dispose functionality
 */
export function createMockElement(
  options: {
    disposeError?: Error;
    textContent?: string;
    attributes?: Record<string, string>;
    selector?: string;
  } = {}
): MockElement {
  return {
    dispose: () => {
      if (options.disposeError) {
        throw options.disposeError;
      }
      return Promise.resolve();
    },
    textContent: async () => options.textContent || 'mock content',
    getAttribute: async (name: string) => options.attributes?.[name] || null,
    evaluate: async (_fn: (...args: unknown[]) => unknown) =>
      options.selector || 'mock-selector',
  };
}

/**
 * Create a mock page with elements
 */
export function createMockPage(elements: MockElement[] = []): MockPage {
  return {
    $$: async (_selector: string) => elements,
  };
}

/**
 * Create multiple mock elements with various dispose behaviors
 */
export function createMockElements(
  count: number,
  errorIndices: number[] = []
): MockElement[] {
  return Array.from({ length: count }, (_, i) => {
    const shouldError = errorIndices.includes(i);
    return createMockElement({
      disposeError: shouldError
        ? new Error(`Element ${i} dispose failed`)
        : undefined,
      textContent: `content ${i}`,
      selector: `selector-${i}`,
    });
  });
}

/**
 * Measure execution time of an async function
 */
export async function measureExecutionTime<T>(
  fn: () => Promise<T>
): Promise<{ result: T; executionTime: number }> {
  const startTime = Date.now();
  const result = await fn();
  const executionTime = Date.now() - startTime;
  return { result, executionTime };
}

/**
 * Assert that execution time is within acceptable bounds
 */
export function assertExecutionTime(
  executionTime: number,
  maxTime: number,
  testName: string
): void {
  if (executionTime > maxTime) {
    throw new Error(
      `${testName} took ${executionTime}ms, expected < ${maxTime}ms`
    );
  }
}

/**
 * Check if console output contains expected warning patterns
 */
export function expectConsoleWarning(
  consoleCapture: ConsoleCapture,
  pattern: string | RegExp
): void {
  const warnCalls = consoleCapture.getWarnCalls();
  const hasPattern = warnCalls.some((call) =>
    call.some((arg) => {
      const message = String(arg);
      return typeof pattern === 'string'
        ? message.includes(pattern)
        : pattern.test(message);
    })
  );

  if (!hasPattern) {
    throw new Error(
      `Expected console warning containing "${pattern}", but found: ${JSON.stringify(
        warnCalls,
        null,
        2
      )}`
    );
  }
}

/**
 * Verify diagnostic error structure
 */
export function expectDiagnosticError(
  error: Error | string,
  expectedComponent: string,
  expectedOperation: string
): void {
  if (!(error.component && error.operation)) {
    throw new Error(
      'Expected DiagnosticError structure with component and operation'
    );
  }

  if (error.component !== expectedComponent) {
    throw new Error(
      `Expected component "${expectedComponent}", got "${error.component}"`
    );
  }

  if (error.operation !== expectedOperation) {
    throw new Error(
      `Expected operation "${expectedOperation}", got "${error.operation}"`
    );
  }
}

/**
 * HTTP Transport Test Helpers
 */

/**
 * Create and connect an HTTP client for testing
 */
export async function createHttpClient(
  url: URL,
  clientName = 'test',
  clientVersion = '1.0.0'
): Promise<{ client: Client; transport: StreamableHTTPClientTransport }> {
  const transport = new StreamableHTTPClientTransport(new URL('/mcp', url));
  const client = new Client({ name: clientName, version: clientVersion });
  await client.connect(transport);
  return { client, transport };
}

/**
 * Lifecycle helper for HTTP client test patterns
 */
export async function withHttpClient<T>(
  url: URL,
  testFunction: (
    client: Client,
    transport: StreamableHTTPClientTransport
  ) => Promise<T>,
  clientName = 'test'
): Promise<T> {
  const { client, transport } = await createHttpClient(url, clientName);
  try {
    return await testFunction(client, transport);
  } finally {
    await transport.terminateSession();
    await client.close();
  }
}

/**
 * Execute a browser navigation call for testing
 */
export async function navigateToUrl(
  client: Client,
  url: string
): Promise<CallToolResponse> {
  return await client.callTool({
    name: 'browser_navigate',
    arguments: { url },
  });
}

/**
 * Create a mock context object commonly used in navigation tests
 */
export function createMockContext(tab: Tab): MockContext {
  return {
    currentTab: () => tab,
    currentTabOrDie: () => tab,
    tabs: () => [tab],
    config: { imageResponses: 'include' },
  } as MockContext;
}

/**
 * Create a Tab with mock context - reduces boilerplate in navigation tests
 */
export function createTabWithMockContext(
  page: Page,
  callback: () => void = () => {
    // Default empty callback for Tab constructor
  }
): { tab: Tab; mockContext: MockContext } {
  const mockContext = createMockContext(null);
  const tab = new Tab(mockContext, page, callback);
  // Fix circular reference
  mockContext.currentTab = () => tab;
  mockContext.currentTabOrDie = () => tab;
  mockContext.tabs = () => [tab];
  return { tab, mockContext };
}

/**
 * Helper function to set basic HTML content on test server
 */
export function setServerContent(
  server: TestServer,
  path: string,
  htmlContent: string
): void {
  server.setContent(path, htmlContent, 'text/html');
}

/**
 * Common client tool call wrapper with default expectation handling
 */
export async function callTool(
  client: Client,
  name: string,
  args: Record<string, unknown>
): Promise<CallToolResponse> {
  return await client.callTool({
    name,
    arguments: args,
  });
}

/**
 * Helper for common browser_navigate + assertion pattern
 */
export async function navigateAndExpectTitle(
  client: Client,
  url: string,
  expectedTitle = 'Title'
): Promise<CallToolResponse> {
  const result = await navigateToUrl(client, url);
  expect(result).toEqual(
    expect.objectContaining({
      pageState: expect.stringContaining(`Page Title: ${expectedTitle}`),
    })
  );
  return result;
}

/**
 * Common expectation helpers to reduce toHaveResponse duplication
 */
export function expectPageTitle(expectedTitle = 'Title') {
  return expect.objectContaining({
    pageState: expect.stringContaining(`**Page Title:** ${expectedTitle}`),
  });
}

export function expectPlaywrightCode(expectedCode: string) {
  return expect.objectContaining({
    code: expectedCode,
  });
}

export function expectPageStateContaining(text: string) {
  return expect.objectContaining({
    pageState: expect.stringContaining(text),
  });
}

export function expectCodeAndPageState(
  expectedCode: string,
  pageStateText: string
) {
  return expect.objectContaining({
    code: expectedCode,
    pageState: expect.stringContaining(pageStateText),
  });
}

export function expectCodeAndResult(
  expectedCode: string,
  expectedResult: string
) {
  return expect.objectContaining({
    code: expectedCode,
    result: expectedResult,
  });
}

/**
 * Common HTML templates to reduce duplication across test files
 */
export const HTML_TEMPLATES = {
  BASIC_BUTTON: `
    <title>Title</title>
    <button>Submit</button>
  `,
  BASIC_TITLE_ONLY: '<title>Title</title>',
  HELLO_WORLD_HEADING: '<h1>Hello, world!</h1>',
  SIMPLE_INPUT_FORM: `
    <title>Title</title>
    <input type="text" placeholder="Enter text" />
  `,
  CLICKABLE_HEADING: (text = 'Click me') => `
    <title>Title</title>
    <h1>${text}</h1>
  `,
  BUTTON_WITH_SCRIPT: (buttonText: string, scriptContent: string) => `
    <title>Title</title>
    <button>${buttonText}</button>
    <script>${scriptContent}</script>
  `,
  CLICKABLE_HEADING_WITH_SCRIPT: (
    headingText: string,
    scriptContent: string,
    eventType = 'ondblclick'
  ) => `
    <title>Title</title>
    <script>${scriptContent}</script>
    <h1 ${eventType}="handle()">${headingText}</h1>
  `,
  CONTEXT_MENU_BUTTON: (buttonText = 'Menu') => `
    <title>Title</title>
    <button oncontextmenu="handle">${buttonText}</button>
    <script>
      document.addEventListener('contextmenu', event => {
        event.preventDefault();
        document.querySelector('button').textContent = 'Right clicked';
      });
    </script>
  `,
  // Dialog templates to reduce duplication in dialog tests
  ALERT_BUTTON: (buttonText = 'Button', alertMessage = 'Alert') => `
    <title>Title</title>
    <body>
      <button onclick="alert('${alertMessage}')">${buttonText}</button>
    </body>
  `,
  DOUBLE_ALERT_BUTTON: (buttonText = 'Button') => `
    <title>Title</title>
    <body>
      <button onclick="alert('Alert 1');alert('Alert 2');">${buttonText}</button>
    </body>
  `,
  CONFIRM_BUTTON: (buttonText = 'Button', confirmMessage = 'Confirm') => `
    <title>Title</title>
    <body>
      <button onclick="document.body.textContent = confirm('${confirmMessage}')">${buttonText}</button>
    </body>
  `,
  PROMPT_BUTTON: (buttonText = 'Button', promptMessage = 'Prompt') => `
    <title>Title</title>
    <body>
      <button onclick="document.body.textContent = prompt('${promptMessage}')">${buttonText}</button>
    </body>
  `,
  DELAYED_ALERT_BUTTON: (
    buttonText = 'Button',
    delay = 100,
    alertMessage = 'Alert'
  ) => `
    <button onclick="setTimeout(() => alert('${alertMessage}'), ${delay})">${buttonText}</button>
  `,
  // Input form variations
  KEYPRESS_INPUT: `
    <!DOCTYPE html>
    <html>
      <input type='keypress' onkeypress="console.log('Key pressed:', event.key, ', Text:', event.target.value)"></input>
    </html>
  `,
  KEYDOWN_INPUT: `
    <input type='text' onkeydown="console.log('Key pressed:', event.key, 'Text:', event.target.value)"></input>
  `,
  INPUT_WITH_CONSOLE: `
    <input type='text' oninput="console.log('New value: ' + event.target.value)"></input>
  `,
  // Wait test templates
  WAIT_FOR_TEXT_UPDATE: `
    <script>
      function update() {
        setTimeout(() => {
          document.querySelector('div').textContent = 'Text to appear';
        }, 1000);
      }
    </script>
    <body>
      <button onclick="update()">Click me</button>
      <div>Text to disappear</div>
    </body>
  `,
  // Console templates to reduce duplication in console tests
  CONSOLE_LOG_ERROR: `
    <!DOCTYPE html>
    <html>
      <script>
        console.log("Hello, world!");
        console.error("Error");
      </script>
    </html>
  `,
  CONSOLE_SCRIPT_ERROR: `
    <!DOCTYPE html>
    <html>
      <script>
        throw new Error("Error in script");
      </script>
    </html>
  `,
  CONSOLE_CLICK_BUTTON: `
    <!DOCTYPE html>
    <html>
      <button onclick="console.log('Hello, world!');">Click me</button>
    </html>
  `,
} as const;
/**
 * HTML templates for browser diagnose tests
 */
export const DIAGNOSE_HTML_TEMPLATES = {
  BASIC_WITH_IFRAME: `
    <div>
      <button>Click Me</button>
      <iframe src="data:text/html,<h1>Frame Content</h1>"></iframe>
      <input type="text" placeholder="Enter text">
    </div>
  `,
  BUTTONS_WITH_DATA_ACTION: `
    <div>
      <button data-action="submit">Submit</button>
      <button data-action="cancel">Cancel</button>
    </div>
  `,
  SIMPLE_BUTTON_DIV: `
    <div>
      <button>Test</button>
    </div>
  `,
  COMPREHENSIVE_FORM: `
    <div>
      <h1>Test Page</h1>
      <form>
        <input type="text" name="username" placeholder="Username">
        <input type="password" name="password" placeholder="Password">
        <button type="submit">Login</button>
      </form>
      <iframe src="about:blank"></iframe>
    </div>
  `,
  IFRAME_WITH_HIDDEN_BUTTON: `
    <div>
      <iframe src="data:text/html,<button>Inside Frame</button>"></iframe>
      <button style="display: none;">Hidden Button</button>
    </div>
  `,
} as const;

/**
 * Common expectation objects for diagnose tests
 */
export const DIAGNOSE_EXPECTATIONS = {
  NO_SNAPSHOT: {
    includeSnapshot: false,
  },
  WITH_PERFORMANCE: {
    includeSnapshot: false,
    includePerformanceMetrics: true,
  },
  COMPREHENSIVE: {
    includeSnapshot: false,
    includePerformanceMetrics: true,
    includeAccessibilityInfo: true,
  },
  WITH_TROUBLESHOOTING: {
    includeSnapshot: false,
    includeTroubleshootingSuggestions: true,
  },
} as const;
/**
 * Helper functions for browser_diagnose tests
 */

/**
 * Setup and execute a basic diagnose test
 */
export async function setupDiagnoseTest(
  client: Client,
  server: TestServer,
  htmlContent: string,
  diagnoseArgs: Record<string, unknown> = {},
  path = '/'
): Promise<CallToolResponse> {
  setServerContent(server, path, htmlContent);
  await navigateToUrl(client, server.PREFIX);

  return await callTool(client, 'browser_diagnose', {
    expectation: DIAGNOSE_EXPECTATIONS.NO_SNAPSHOT,
    ...diagnoseArgs,
  });
}

/**
 * Common assertions for diagnose test results
 */
export function expectDiagnoseSuccess(result: CallToolResponse): void {
  expect(result.isError).toBeFalsy();
  expect(result.content[0].text).toContain('Page Diagnostic Report');
}

/**
 * Assert that diagnose result contains specific content
 */
export function expectDiagnoseContent(
  result: CallToolResponse,
  expectedTexts: string[]
): void {
  expectDiagnoseSuccess(result);
  for (const text of expectedTexts) {
    expect(result.content[0].text).toContain(text);
  }
}

/**
 * Setup diagnose test with element search
 */
export async function setupDiagnoseWithElementSearch(
  client: Client,
  server: TestServer,
  htmlContent: string,
  searchCriteria: SearchCriteria
): Promise<CallToolResponse> {
  return await setupDiagnoseTest(client, server, htmlContent, {
    searchForElements: searchCriteria,
  });
}

/**
 * Common data URLs for quick inline HTML
 */
export const DATA_URLS = {
  SIMPLE_PAGE: (heading: string) =>
    `data:text/html,<html><body><h1>${heading}</h1></body></html>`,
  WITH_SCRIPT: (heading: string, script: string) =>
    `data:text/html,<html><body><h1>${heading}</h1><script>${script}</script></body></html>`,
  FORM_PAGE: (inputId = 'search', inputValue = 'test') =>
    `data:text/html,<html><body><input id="${inputId}" type="text" value="${inputValue}"><h1>Before Navigation</h1></body></html>`,
  SEARCH_RESULTS_PAGE: (searchTerm: string) =>
    `data:text/html,<html><body><h1>Search Results</h1><p>Results for: ${searchTerm}</p></body></html>`,
} as const;

/**
 * HTML templates for browser_find_elements tests
 */
export const FIND_ELEMENTS_HTML_TEMPLATES = {
  MULTI_CRITERIA_ELEMENTS: `
    <div>
      <button class="btn">Submit</button>
      <input type="submit" value="Submit">
      <a role="button">Link Button</a>
    </div>
  `,
  FORM_WITH_INPUTS: `
    <form>
      <input type="text" name="username">
      <input type="email" name="email">
    </form>
  `,
  BUTTONS_WITH_DATA_ACTION: `
    <div>
      <button data-action="save">Save</button>
      <button data-action="cancel">Cancel</button>
    </div>
  `,
  NO_BUTTONS_CONTENT: `
    <div>
      <span>No buttons here</span>
    </div>
  `,
  MULTIPLE_BUTTONS: (count: number) =>
    `<div>${Array.from(
      { length: count },
      (_, i) => `<button>Button ${i}</button>`
    ).join('')}</div>`,
} as const;

/**
 * Browser lifecycle assertion patterns for HTTP tests
 */
export interface BrowserLifecycleExpectations {
  httpSessions: number;
  contexts: number;
  browserContextType: 'isolated' | 'persistent';
  obtainBrowser?: number;
  closeBrowser?: number;
  userDataDir?: number;
}

/**
 * Common test setup utilities for standard tests (non-diagnostic)
 */
export class StandardTestSetup {
  private consoleCapture: ConsoleCapture = new ConsoleCapture();

  /**
   * Setup for each standard test
   */
  beforeEach(captureConsole = false): ConsoleCapture {
    if (captureConsole) {
      this.consoleCapture.start();
    }
    return this.consoleCapture;
  }

  /**
   * Cleanup for each standard test
   */
  afterEach(): void {
    this.consoleCapture.stop();
    this.consoleCapture.clear();
  }

  getConsoleCapture(): ConsoleCapture {
    return this.consoleCapture;
  }
}

/**
 * Helper for navigation-based test setups
 */
export async function setupBasicNavigation(
  client: Client,
  server: TestServer,
  path = '/',
  content = HTML_TEMPLATES.BASIC_TITLE_ONLY
): Promise<CallToolResponse> {
  setServerContent(server, path, content);
  return await navigateToUrl(client, server.PREFIX);
}

// Regex constants for browser lifecycle testing
const BROWSER_LIFECYCLE_PATTERNS = {
  CREATE_HTTP_SESSION: /create http session/,
  DELETE_HTTP_SESSION: /delete http session/,
  CREATE_CONTEXT: /create context/,
  CLOSE_CONTEXT: /close context/,
  CREATE_BROWSER_CONTEXT_ISOLATED: /create browser context \(isolated\)/,
  CLOSE_BROWSER_CONTEXT_ISOLATED: /close browser context \(isolated\)/,
  CREATE_BROWSER_CONTEXT_PERSISTENT: /create browser context \(persistent\)/,
  CLOSE_BROWSER_CONTEXT_PERSISTENT: /close browser context \(persistent\)/,
  OBTAIN_BROWSER_ISOLATED: /obtain browser \(isolated\)/,
  CLOSE_BROWSER_ISOLATED: /close browser \(isolated\)/,
  LOCK_USER_DATA_DIR: /lock user data dir/,
  RELEASE_USER_DATA_DIR: /release user data dir/,
};

/**
 * Check browser lifecycle assertions based on stderr output
 */
export function expectBrowserLifecycle(
  stderr: () => string,
  expectations: BrowserLifecycleExpectations
): void {
  const lines = stderr().split('\n');

  // Count occurrences of each pattern
  const countMatches = (pattern: RegExp) =>
    lines.filter((line) => line.match(pattern)).length;

  // HTTP session assertions
  expect(countMatches(BROWSER_LIFECYCLE_PATTERNS.CREATE_HTTP_SESSION)).toBe(
    expectations.httpSessions
  );
  expect(countMatches(BROWSER_LIFECYCLE_PATTERNS.DELETE_HTTP_SESSION)).toBe(
    expectations.httpSessions
  );

  // Context assertions
  expect(countMatches(BROWSER_LIFECYCLE_PATTERNS.CREATE_CONTEXT)).toBe(
    expectations.contexts
  );
  expect(countMatches(BROWSER_LIFECYCLE_PATTERNS.CLOSE_CONTEXT)).toBe(
    expectations.contexts
  );

  // Browser context type-specific assertions
  if (expectations.browserContextType === 'isolated') {
    expect(
      countMatches(BROWSER_LIFECYCLE_PATTERNS.CREATE_BROWSER_CONTEXT_ISOLATED)
    ).toBe(expectations.contexts);
    expect(
      countMatches(BROWSER_LIFECYCLE_PATTERNS.CLOSE_BROWSER_CONTEXT_ISOLATED)
    ).toBe(expectations.contexts);

    // Optional browser isolation assertions
    if (expectations.obtainBrowser !== undefined) {
      expect(
        countMatches(BROWSER_LIFECYCLE_PATTERNS.OBTAIN_BROWSER_ISOLATED)
      ).toBe(expectations.obtainBrowser);
    }
    if (expectations.closeBrowser !== undefined) {
      expect(
        countMatches(BROWSER_LIFECYCLE_PATTERNS.CLOSE_BROWSER_ISOLATED)
      ).toBe(expectations.closeBrowser);
    }
  } else if (expectations.browserContextType === 'persistent') {
    expect(
      countMatches(BROWSER_LIFECYCLE_PATTERNS.CREATE_BROWSER_CONTEXT_PERSISTENT)
    ).toBe(expectations.contexts);
    expect(
      countMatches(BROWSER_LIFECYCLE_PATTERNS.CLOSE_BROWSER_CONTEXT_PERSISTENT)
    ).toBe(expectations.contexts);

    // Optional user data directory assertions
    if (expectations.userDataDir !== undefined) {
      expect(countMatches(BROWSER_LIFECYCLE_PATTERNS.LOCK_USER_DATA_DIR)).toBe(
        expectations.userDataDir
      );
      expect(
        countMatches(BROWSER_LIFECYCLE_PATTERNS.RELEASE_USER_DATA_DIR)
      ).toBe(expectations.userDataDir);
    }
  }
}

/**
 * Common expectation objects for find_elements tests
 */
export const FIND_ELEMENTS_EXPECTATIONS = {
  NO_SNAPSHOT: {
    includeSnapshot: false,
  },
  WITH_MAX_RESULTS: (maxResults: number) => ({
    includeSnapshot: false,
    maxResults,
  }),
} as const;

/**
 * Helper functions for browser_find_elements tests
 */

/**
 * Setup and execute a basic find_elements test
 */
export async function setupFindElementsTest(
  client: Client,
  server: TestServer,
  htmlContent: string,
  searchCriteria: Record<string, unknown>,
  additionalArgs: Record<string, unknown> = {},
  path = '/'
): Promise<CallToolResponse> {
  setServerContent(server, path, htmlContent);
  await navigateToUrl(client, server.PREFIX);

  return await callTool(client, 'browser_find_elements', {
    searchCriteria,
    expectation: FIND_ELEMENTS_EXPECTATIONS.NO_SNAPSHOT,
    ...additionalArgs,
  });
}

/**
 * Common assertions for find_elements test results
 */
export function expectFindElementsSuccess(result: CallToolResponse): void {
  expect(result.isError).toBeFalsy();
  expect(result.content[0].text).toContain('Found');
}

/**
 * Assert that find_elements result contains no matches
 */
export function expectFindElementsNoMatches(result: CallToolResponse): void {
  expect(result.isError).toBeFalsy();
  expect(result.content[0].text).toContain('No elements found');
}

/**
 * Setup find_elements test with multiple search criteria
 */
export async function setupFindElementsWithMultipleCriteria(
  client: Client,
  server: TestServer,
  htmlContent: string,
  searchCriteria: Record<string, unknown>,
  maxResults?: number
): Promise<CallToolResponse> {
  const additionalArgs = maxResults ? { maxResults } : {};
  return await setupFindElementsTest(
    client,
    server,
    htmlContent,
    searchCriteria,
    additionalArgs
  );
}

/**
 * Dialog test helpers to reduce duplication in dialog tests
 */

/**
 * Common expectation objects for dialog tests
 */
export const DIALOG_EXPECTATIONS = {
  BUTTON_VISIBLE: (buttonText = 'Button') =>
    expect.stringContaining(`- button "${buttonText}" [ref=e2]`),
  BUTTON_CLICKED: (buttonText = 'Button') => ({
    code: `await page.getByRole('button', { name: '${buttonText}' }).click();`,
  }),
  ALERT_MODAL: (message: string) =>
    expect.stringContaining(
      `- ["alert" dialog with message "${message}"]: can be handled by the "browser_handle_dialog" tool`
    ),
  CONFIRM_MODAL: (message: string) =>
    expect.stringContaining(
      `- ["confirm" dialog with message "${message}"]: can be handled by the "browser_handle_dialog" tool`
    ),
  PROMPT_MODAL: (message: string) =>
    expect.stringContaining(
      `- ["prompt" dialog with message "${message}"]: can be handled by the "browser_handle_dialog" tool`
    ),
  NO_MODAL: undefined,
  RESULT_TEXT: (text: string) =>
    expect.stringContaining(`- generic [active] [ref=e1]: "${text}"`),
  RESULT_CONTENT: (content: string) =>
    expect.stringContaining(`- generic [active] [ref=e1]: ${content}`),
} as const;

/**
 * Setup dialog test with navigation and initial button visibility check
 */
export async function setupDialogTest(
  client: Client,
  server: TestServer,
  htmlContent: string,
  buttonText = 'Button',
  path = '/'
): Promise<void> {
  setServerContent(server, path, htmlContent);

  const navigateResult = await navigateToUrl(client, server.PREFIX);
  expect(navigateResult).toHaveResponse({
    pageState: DIALOG_EXPECTATIONS.BUTTON_VISIBLE(buttonText),
  });
}

/**
 * Execute button click and verify modal state
 */
export async function clickButtonAndExpectModal(
  client: Client,
  buttonText: string,
  expectedModalState: Record<string, unknown>,
  expectedCode?: string
): Promise<CallToolResponse> {
  const result = await callTool(client, 'browser_click', {
    element: buttonText,
    ref: 'e2',
  });

  const expectedResponse: Record<string, unknown> = {
    modalState: expectedModalState,
  };

  if (expectedCode !== undefined) {
    expectedResponse.code = expectedCode;
  }

  expect(result).toHaveResponse(expectedResponse);
  return result;
}

/**
 * Handle dialog and verify final state
 */
export async function handleDialogAndExpectState(
  client: Client,
  accept: boolean,
  expectedPageState?: Record<string, unknown>,
  expectedModalState?: Record<string, unknown>,
  promptText?: string
): Promise<CallToolResponse> {
  const args: Record<string, unknown> = { accept };
  if (promptText !== undefined) {
    args.promptText = promptText;
  }

  const result = await callTool(client, 'browser_handle_dialog', args);

  const expectedResponse: Record<string, unknown> = {};
  if (expectedModalState !== undefined) {
    expectedResponse.modalState = expectedModalState;
  }
  if (expectedPageState !== undefined) {
    expectedResponse.pageState = expectedPageState;
  }

  expect(result).toHaveResponse(expectedResponse);
  return result;
}

/**
 * Complete dialog test workflow: setup -> click -> handle dialog
 */
export interface DialogTestConfig {
  dialogType: 'alert' | 'confirm' | 'prompt';
  message: string;
  accept: boolean;
  expectedResult?: string;
  promptText?: string;
}

export interface DialogUIConfig {
  htmlContent: string;
  buttonText?: string;
}

export async function executeDialogTest(
  client: Client,
  server: TestServer,
  dialogConfig: DialogTestConfig,
  uiConfig: DialogUIConfig
): Promise<void> {
  const { dialogType, message, accept, expectedResult, promptText } =
    dialogConfig;
  const { htmlContent, buttonText = 'Button' } = uiConfig;

  // Setup
  await setupDialogTest(client, server, htmlContent, buttonText);

  // Click button and expect modal
  let modalExpectation: Record<string, unknown>;
  if (dialogType === 'alert') {
    modalExpectation = DIALOG_EXPECTATIONS.ALERT_MODAL(message);
  } else if (dialogType === 'confirm') {
    modalExpectation = DIALOG_EXPECTATIONS.CONFIRM_MODAL(message);
  } else {
    modalExpectation = DIALOG_EXPECTATIONS.PROMPT_MODAL(message);
  }

  await clickButtonAndExpectModal(
    client,
    buttonText,
    modalExpectation,
    DIALOG_EXPECTATIONS.BUTTON_CLICKED(buttonText).code
  );

  // Handle dialog
  const expectedPageState =
    expectedResult !== undefined
      ? DIALOG_EXPECTATIONS.RESULT_TEXT(expectedResult)
      : expect.stringContaining(`- button "${buttonText}"`);

  await handleDialogAndExpectState(
    client,
    accept,
    expectedPageState,
    DIALOG_EXPECTATIONS.NO_MODAL,
    promptText
  );
}

/**
 * HTML templates for browser screenshot tests
 */
export const SCREENSHOT_HTML_TEMPLATES = {
  MINIMAL_TEST: '<div>Test Page for Screenshot</div>',
  FULL_TEST: '<div>Full Test Page for Screenshot</div>',
  FULL_PAGE_GRADIENT: `
    <div style="height: 2000px; background: linear-gradient(red, blue);">
      Full page screenshot test content
    </div>
  `,
} as const;

/**
 * Common expectation objects for screenshot tests
 */
export const SCREENSHOT_EXPECTATIONS = {
  MINIMAL_RESPONSE: {
    includeSnapshot: false,
    includeConsole: false,
    includeDownloads: false,
    includeTabs: false,
    includeCode: false,
  },
  FULL_RESPONSE: {
    includeSnapshot: true,
    includeConsole: true,
    includeDownloads: true,
    includeTabs: true,
    includeCode: true,
  },
  FULL_PAGE_RESPONSE: {
    includeSnapshot: false,
    includeConsole: false,
    includeDownloads: false,
    includeTabs: false,
    includeCode: true,
  },
} as const;

/**
 * Common screenshot result assertions
 */
export const SCREENSHOT_ASSERTIONS = {
  VIEWPORT_SCREENSHOT: 'Took the viewport screenshot',
  FULL_PAGE_SCREENSHOT: 'Took the full page screenshot',
  PAGE_SNAPSHOT_PRESENT: 'Page Snapshot:',
  CONSOLE_MESSAGES_ABSENT: 'Console messages',
} as const;

/**
 * Helper functions for browser screenshot tests
 */

/**
 * Setup and execute a basic screenshot test
 */
export async function setupScreenshotTest(
  client: Client,
  server: TestServer,
  htmlContent: string,
  screenshotArgs: Record<string, unknown>,
  path = '/'
): Promise<CallToolResponse> {
  setServerContent(server, path, htmlContent);
  await navigateToUrl(client, server.PREFIX);

  return await callTool(client, 'browser_take_screenshot', screenshotArgs);
}

/**
 * Execute screenshot test with minimal expectation
 */
export async function executeMinimalScreenshotTest(
  client: Client,
  server: TestServer,
  htmlContent: string = SCREENSHOT_HTML_TEMPLATES.MINIMAL_TEST,
  imageType: 'png' | 'jpeg' = 'png'
): Promise<CallToolResponse> {
  return await setupScreenshotTest(client, server, htmlContent, {
    type: imageType,
    expectation: SCREENSHOT_EXPECTATIONS.MINIMAL_RESPONSE,
  });
}

/**
 * Execute screenshot test with full expectation
 */
export async function executeFullScreenshotTest(
  client: Client,
  server: TestServer,
  htmlContent: string = SCREENSHOT_HTML_TEMPLATES.FULL_TEST,
  imageType: 'png' | 'jpeg' = 'jpeg'
): Promise<CallToolResponse> {
  return await setupScreenshotTest(client, server, htmlContent, {
    type: imageType,
    expectation: SCREENSHOT_EXPECTATIONS.FULL_RESPONSE,
  });
}

/**
 * Execute full page screenshot test
 */
export async function executeFullPageScreenshotTest(
  client: Client,
  server: TestServer,
  htmlContent: string = SCREENSHOT_HTML_TEMPLATES.FULL_PAGE_GRADIENT,
  imageType: 'png' | 'jpeg' = 'png'
): Promise<CallToolResponse> {
  return await setupScreenshotTest(client, server, htmlContent, {
    type: imageType,
    fullPage: true,
    expectation: SCREENSHOT_EXPECTATIONS.FULL_PAGE_RESPONSE,
  });
}

/**
 * Common assertions for screenshot test results
 */
export function expectScreenshotSuccess(
  result: CallToolResponse,
  screenshotType: 'viewport' | 'fullPage'
): void {
  expect(result.isError).toBeFalsy();
  const expectedText =
    screenshotType === 'viewport'
      ? SCREENSHOT_ASSERTIONS.VIEWPORT_SCREENSHOT
      : SCREENSHOT_ASSERTIONS.FULL_PAGE_SCREENSHOT;
  expect(result.content[0].text).toContain(expectedText);
}

/**
 * Assert minimal response (no additional content)
 */
export function expectMinimalScreenshotResponse(
  result: CallToolResponse
): void {
  expectScreenshotSuccess(result, 'viewport');
  expect(result.content[0].text).not.toContain(
    SCREENSHOT_ASSERTIONS.PAGE_SNAPSHOT_PRESENT
  );
  expect(result.content[0].text).not.toContain(
    SCREENSHOT_ASSERTIONS.CONSOLE_MESSAGES_ABSENT
  );
}

/**
 * Assert full response (with additional content)
 */
export function expectFullScreenshotResponse(result: CallToolResponse): void {
  expectScreenshotSuccess(result, 'viewport');
  expect(result.content[0].text).toContain(
    SCREENSHOT_ASSERTIONS.PAGE_SNAPSHOT_PRESENT
  );
}

/**
 * Assert full page screenshot response
 */
export function expectFullPageScreenshotResponse(
  result: CallToolResponse
): void {
  expectScreenshotSuccess(result, 'fullPage');
  expect(result.content[0].text).not.toContain(
    SCREENSHOT_ASSERTIONS.PAGE_SNAPSHOT_PRESENT
  );
}

/**
 * HTML templates for mouse operation tests
 */
export const MOUSE_HTML_TEMPLATES = {
  BASIC_TEST: '<div>Test Page</div>',
  FULL_TEST: '<div>Full Test Page</div>',
} as const;

/**
 * Common expectation objects for mouse tests
 */
export const MOUSE_EXPECTATIONS = {
  MINIMAL_RESPONSE: {
    includeSnapshot: false,
    includeConsole: false,
    includeDownloads: false,
    includeTabs: false,
    includeCode: true,
  },
  FULL_RESPONSE: {
    includeSnapshot: true,
    includeConsole: true,
    includeDownloads: true,
    includeTabs: true,
    includeCode: true,
  },
} as const;

/**
 * Mouse operation test assertions
 */
export const MOUSE_ASSERTIONS = {
  NO_PAGE_SNAPSHOT: 'Page Snapshot:',
  NO_CONSOLE_MESSAGES: 'Console messages',
  MOUSE_MOVE: (x: number, y: number) => `await page.mouse.move(${x}, ${y});`,
  MOUSE_DOWN: 'await page.mouse.down();',
  MOUSE_UP: 'await page.mouse.up();',
} as const;

/**
 * Setup and execute a mouse operation test
 */
export async function setupMouseTest(
  client: Client,
  server: TestServer,
  toolName: string,
  args: Record<string, unknown>,
  htmlContent: string = MOUSE_HTML_TEMPLATES.BASIC_TEST,
  path = '/'
): Promise<CallToolResponse> {
  setServerContent(server, path, htmlContent);
  await navigateToUrl(client, server.PREFIX);

  return await callTool(client, toolName, args);
}

/**
 * Execute mouse_move_xy test with minimal expectation
 */
export async function executeMouseMoveTest(
  client: Client,
  server: TestServer,
  x: number,
  y: number,
  htmlContent?: string
): Promise<CallToolResponse> {
  return await setupMouseTest(
    client,
    server,
    'browser_mouse_move_xy',
    {
      element: 'test element',
      x,
      y,
      expectation: MOUSE_EXPECTATIONS.MINIMAL_RESPONSE,
    },
    htmlContent
  );
}

/**
 * Execute mouse_click_xy test with minimal expectation
 */
export async function executeMouseClickTest(
  client: Client,
  server: TestServer,
  x: number,
  y: number,
  htmlContent?: string
): Promise<CallToolResponse> {
  return await setupMouseTest(
    client,
    server,
    'browser_mouse_click_xy',
    {
      element: 'test element',
      x,
      y,
      expectation: MOUSE_EXPECTATIONS.MINIMAL_RESPONSE,
    },
    htmlContent
  );
}

/**
 * Execute mouse_drag_xy test with minimal expectation
 */
export async function executeMouseDragTest(
  client: Client,
  server: TestServer,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  htmlContent?: string
): Promise<CallToolResponse> {
  return await setupMouseTest(
    client,
    server,
    'browser_mouse_drag_xy',
    {
      element: 'test element',
      startX,
      startY,
      endX,
      endY,
      expectation: MOUSE_EXPECTATIONS.MINIMAL_RESPONSE,
    },
    htmlContent
  );
}

/**
 * Common assertions for mouse operation test results
 */
export function expectMinimalMouseResponse(result: CallToolResponse): void {
  expect(result.content[0].text).not.toContain(
    MOUSE_ASSERTIONS.NO_PAGE_SNAPSHOT
  );
  expect(result.content[0].text).not.toContain(
    MOUSE_ASSERTIONS.NO_CONSOLE_MESSAGES
  );
}

/**
 * Assert mouse move operation code
 */
export function expectMouseMoveCode(
  result: CallToolResponse,
  x: number,
  y: number
): void {
  expectMinimalMouseResponse(result);
  expect(result.content[0].text).toContain(MOUSE_ASSERTIONS.MOUSE_MOVE(x, y));
}

/**
 * Assert mouse click operation code
 */
export function expectMouseClickCode(
  result: CallToolResponse,
  x: number,
  y: number
): void {
  expectMinimalMouseResponse(result);
  expect(result.content[0].text).toContain(MOUSE_ASSERTIONS.MOUSE_MOVE(x, y));
  expect(result.content[0].text).toContain(MOUSE_ASSERTIONS.MOUSE_DOWN);
  expect(result.content[0].text).toContain(MOUSE_ASSERTIONS.MOUSE_UP);
}

/**
 * Assert mouse drag operation code
 */
export function expectMouseDragCode(
  result: CallToolResponse,
  startX: number,
  startY: number,
  endX: number,
  endY: number
): void {
  expectMinimalMouseResponse(result);
  expect(result.content[0].text).toContain(
    MOUSE_ASSERTIONS.MOUSE_MOVE(startX, startY)
  );
  expect(result.content[0].text).toContain(MOUSE_ASSERTIONS.MOUSE_DOWN);
  expect(result.content[0].text).toContain(
    MOUSE_ASSERTIONS.MOUSE_MOVE(endX, endY)
  );
  expect(result.content[0].text).toContain(MOUSE_ASSERTIONS.MOUSE_UP);
}

/**
 * Common expectation test patterns to reduce duplication
 */

/**
 * Common expectation objects for various test scenarios
 */
export const COMMON_EXPECTATIONS = {
  MINIMAL_RESPONSE: {
    includeSnapshot: false,
    includeConsole: false,
    includeDownloads: false,
    includeTabs: false,
    includeCode: false,
  },
  DEFAULT_TOOL_RESPONSE: {
    includeSnapshot: false,
    includeConsole: false,
    includeDownloads: false,
    includeTabs: false,
    includeCode: false,
  },
  BASIC_FALSE_FLAGS: {
    includeSnapshot: false,
    includeConsole: false,
    includeDownloads: false,
    includeTabs: false,
    includeCode: false,
  },
  EVALUATE_WITH_CODE: {
    includeSnapshot: false,
    includeConsole: false,
    includeDownloads: false,
    includeTabs: false,
    includeCode: true,
  },
  FULL_RESPONSE: {
    includeSnapshot: true,
    includeConsole: true,
    includeDownloads: true,
    includeTabs: true,
    includeCode: true,
  },
} as const;

/**
 * Helper function to test default expectation behavior for tools
 */
export function testDefaultExpectation(
  toolName: string,
  expectedDefaults: Record<string, unknown>
): void {
  const result = getDefaultExpectation(toolName);
  for (const [key, value] of Object.entries(expectedDefaults)) {
    expect(result[key]).toBe(value);
  }
}

/**
 * Helper function to create expectation validation test
 */
export function createExpectationTest(
  expectationData: Record<string, unknown>,
  expectedResult: Record<string, unknown>
): void {
  const result = expectationSchema.parse(expectationData);
  expect(result).toEqual(expectedResult);
}

/**
 * Helper function to test expectation schema validation with invalid data
 */
export function expectSchemaValidationError(
  invalidData: Record<string, unknown>
): void {
  expect(() => {
    expectationSchema.parse(invalidData);
  }).toThrow();
}

/**
 * Helper function for batch execution summary assertions
 */
export function expectBatchExecutionSummary(
  result: CallToolResponse,
  expectedSummary: {
    totalSteps: number;
    successful: number;
    failed: number;
  }
): void {
  expect(result.content[0].text).toContain('Batch Execution Summary');
  expect(result.content[0].text).toContain('✅ Completed');
  expect(result.content[0].text).toContain(
    `Total Steps: ${expectedSummary.totalSteps}`
  );
  expect(result.content[0].text).toContain(
    `Successful: ${expectedSummary.successful}`
  );
  expect(result.content[0].text).toContain(`Failed: ${expectedSummary.failed}`);
}

/**
 * Helper function for creating batch execution test arguments
 */
export function createBatchExecutionArgs(
  steps: Record<string, unknown>[],
  globalExpectation: Record<
    string,
    unknown
  > = COMMON_EXPECTATIONS.MINIMAL_RESPONSE,
  stopOnFirstError = true
): Record<string, unknown> {
  return {
    steps,
    stopOnFirstError,
    globalExpectation,
  };
}

/**
 * Helper function to create basic navigation step for batch execution
 */
export function createNavigationStep(
  url: string,
  expectation: Record<string, unknown> = COMMON_EXPECTATIONS.MINIMAL_RESPONSE
): Record<string, unknown> {
  return {
    tool: 'browser_navigate',
    arguments: { url },
    expectation,
  };
}

/**
 * Helper function for partial snapshot tests
 */
export function expectPartialSnapshotBehavior(
  result: CallToolResponse,
  selectorUsed: string,
  shouldContainSelector = true
): void {
  if (shouldContainSelector) {
    expect(result.content[0].text).toContain(
      `Capturing partial snapshot for selector: ${selectorUsed}`
    );
  } else {
    expect(result.content[0].text).toContain('Falling back to full snapshot');
  }
}

/**
 * Helper function to create HTML content with various complexity levels
 */
export function createTestHtmlContent(
  complexity: 'simple' | 'moderate' | 'complex' = 'simple'
): string {
  switch (complexity) {
    case 'simple':
      return '<title>Test</title><div>Simple content</div>';
    case 'moderate':
      return `
        <title>Test</title>
        <div>
          <header>Header</header>
          <main><h1>Main Content</h1><p>Some text</p></main>
          <footer>Footer</footer>
        </div>
      `;
    case 'complex':
      return `
        <title>Test</title>
        <div>
          <header>Header Content</header>
          <main>
            <h1>Main Content</h1>
            <p>This is the main content area that should be captured by the selector.</p>
            <form>
              <input type="text" placeholder="Username">
              <input type="password" placeholder="Password">
              <button type="submit">Submit</button>
            </form>
          </main>
          <footer>Footer Content</footer>
        </div>
      `;
    default:
      return '<title>Test</title><div>Default content</div>';
  }
}

/**
 * Helper to reduce import statement duplication
 */
import {
  expectationSchema,
  getDefaultExpectation,
} from '../src/schemas/expectation.js';
