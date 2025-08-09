/**
 * Common test utilities and helpers to reduce code duplication
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { expect } from '@playwright/test';
import { DiagnosticThresholds } from '../src/diagnostics/diagnostic-thresholds.js';
import { SmartConfigManager } from '../src/diagnostics/smart-config.js';
import { Tab } from '../src/tab.js';

export type ConsoleMethod = 'log' | 'info' | 'warn' | 'error';

/**
 * Console capture utility for testing
 */
export class ConsoleCapture {
  private originalMethods: Map<ConsoleMethod, (...args: any[]) => void> =
    new Map();
  private capturedMessages: Array<{ level: ConsoleMethod; args: any[] }> = [];

  /**
   * Start capturing console output for specified methods
   */
  start(methods: ConsoleMethod[] = ['warn', 'error', 'info']): void {
    for (const method of methods) {
      this.originalMethods.set(method, console[method]);
      console[method] = (...args: any[]) => {
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
  getMessages(): Array<{ level: ConsoleMethod; args: any[] }> {
    return [...this.capturedMessages];
  }

  /**
   * Get messages for a specific level
   */
  getMessagesForLevel(level: ConsoleMethod): any[][] {
    return this.capturedMessages
      .filter((msg) => msg.level === level)
      .map((msg) => msg.args);
  }

  /**
   * Get warn messages (backward compatibility)
   */
  getWarnCalls(): any[][] {
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
    (SmartConfigManager as any).instance = null;

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
    (SmartConfigManager as any).instance = null;
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
): any {
  return {
    dispose: () => {
      if (options.disposeError) {
        throw options.disposeError;
      }
      return Promise.resolve();
    },
    textContent: async () => options.textContent || 'mock content',
    getAttribute: async (name: string) => options.attributes?.[name] || null,
    evaluate: async (_fn: (...args: any[]) => any) =>
      options.selector || 'mock-selector',
  };
}

/**
 * Create a mock page with elements
 */
export function createMockPage(elements: any[] = []): any {
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
): any[] {
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
  error: any,
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
export async function navigateToUrl(client: Client, url: string): Promise<any> {
  return await client.callTool({
    name: 'browser_navigate',
    arguments: { url },
  });
}

/**
 * Create a mock context object commonly used in navigation tests
 */
export function createMockContext(tab: any): any {
  return {
    currentTab: () => tab,
    currentTabOrDie: () => tab,
    tabs: () => [tab],
    config: { imageResponses: 'include' },
  } as any;
}

/**
 * Create a Tab with mock context - reduces boilerplate in navigation tests
 */
export function createTabWithMockContext(
  page: any,
  callback: () => void = () => {
    // Default empty callback for Tab constructor
  }
): { tab: any; mockContext: any } {
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
  server: any,
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
  args: any
): Promise<any> {
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
): Promise<any> {
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
  server: any,
  path = '/',
  content = HTML_TEMPLATES.BASIC_TITLE_ONLY
): Promise<any> {
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
