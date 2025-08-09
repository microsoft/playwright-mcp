/**
 * Common test utilities to reduce code duplication in test files
 */

import type { ConsoleMessage } from '../../src/tab.js';

/**
 * Create mock console messages for testing
 */
export function createMockConsoleMessages(): ConsoleMessage[] {
  return [
    { type: 'log', text: 'User logged in successfully' },
    { type: 'error', text: 'Database connection failed' },
    { type: 'warn', text: 'Deprecated API usage detected' },
    { type: 'log', text: 'Page rendered successfully' },
    { type: 'error', text: 'Network request timeout' },
    { type: 'info', text: 'Cache cleared' },
    { type: 'log', text: 'User logged in successfully' }, // Duplicate
    { type: 'error', text: 'Authentication failed' },
    { type: 'warn', text: 'API rate limit approaching' },
    { type: 'log', text: 'Component mounted' },
  ];
}

/**
 * Common expectation helpers for console filtering tests
 */
export class ConsoleTestHelpers {
  /**
   * Get console filtering function for testing
   */
  static async getFilterFunction() {
    const { filterConsoleMessages } = await import(
      '../../src/utils/consoleFilter.js'
    );
    return filterConsoleMessages;
  }

  /**
   * Test filtering by message levels
   */
  static async testLevelFiltering(
    levels: readonly string[],
    expectedCount: number
  ) {
    const filterConsoleMessages = await ConsoleTestHelpers.getFilterFunction();
    const messages = createMockConsoleMessages();
    const options = { levels: levels as any };

    const result = filterConsoleMessages(messages, options);
    // Note: Assertion moved to test file to satisfy BiomeJS linting rules
    return result;
  }

  /**
   * Test filtering by patterns
   */
  static async testPatternFiltering(patterns: string[], expectedCount: number) {
    const filterConsoleMessages = await ConsoleTestHelpers.getFilterFunction();
    const messages = createMockConsoleMessages();
    const options = { patterns };

    const result = filterConsoleMessages(messages, options);
    // Note: Assertion moved to test file to satisfy BiomeJS linting rules
    return result;
  }

  /**
   * Test duplicate removal
   */
  static async testDuplicateRemoval(expectedUniqueCount: number) {
    const filterConsoleMessages = await ConsoleTestHelpers.getFilterFunction();
    const messages = createMockConsoleMessages();
    const options = { removeDuplicates: true };

    const result = filterConsoleMessages(messages, options);
    // Note: Assertions moved to test file to satisfy BiomeJS linting rules

    return result;
  }

  /**
   * Test message limit
   */
  static async testMessageLimit(limit: number) {
    const filterConsoleMessages = await ConsoleTestHelpers.getFilterFunction();
    const messages = createMockConsoleMessages();
    const options = { maxMessages: limit };

    const result = filterConsoleMessages(messages, options);
    // Note: Assertion moved to test file to satisfy BiomeJS linting rules
    return result;
  }

  /**
   * Test combined filtering options
   */
  static async testCombinedFiltering(
    options: {
      levels?: readonly string[];
      patterns?: string[];
      removeDuplicates?: boolean;
      maxMessages?: number;
    },
    maxExpectedCount: number
  ) {
    const filterConsoleMessages = await ConsoleTestHelpers.getFilterFunction();
    const messages = createMockConsoleMessages();

    const result = filterConsoleMessages(messages, options);
    // Note: Assertions moved to test file to satisfy BiomeJS linting rules

    return result;
  }
}

/**
 * Common assertion helpers
 */
export class AssertionHelpers {
  /**
   * Assert that a value is within expected range
   */
  static expectInRange(value: number, min: number, max: number) {
    expect(value).toBeGreaterThanOrEqual(min);
    expect(value).toBeLessThanOrEqual(max);
  }

  /**
   * Assert that an array contains unique items
   */
  static expectUniqueItems<T>(array: T[], keySelector?: (item: T) => any) {
    const selector = keySelector || ((item: T) => item);
    const keys = array.map(selector);
    const uniqueKeys = new Set(keys);
    expect(uniqueKeys.size).toBe(array.length);
  }

  /**
   * Assert that error message contains expected text
   */
  static expectErrorMessage(error: unknown, expectedText: string) {
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain(expectedText);
  }
}
