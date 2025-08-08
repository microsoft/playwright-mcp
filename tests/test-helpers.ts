/**
 * Common test utilities and helpers to reduce code duplication
 */

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
