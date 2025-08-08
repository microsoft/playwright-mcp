/**
 * Common test utilities and helpers to reduce code duplication
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { expect } from '@playwright/test';
import { DiagnosticThresholds } from '../src/diagnostics/diagnostic-thresholds.js';
import { SmartConfigManager } from '../src/diagnostics/smart-config.js';

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
