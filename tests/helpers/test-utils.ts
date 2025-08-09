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
   * Check if a value is within expected range
   * Returns validation result for use in test assertions
   */
  static isInRange(value: number, min: number, max: number): boolean {
    return value >= min && value <= max;
  }

  /**
   * Check if array contains unique items
   * Returns validation result for use in test assertions
   */
  static validateUniqueItems<T>(
    array: T[],
    keySelector?: (item: T) => any
  ): {
    isUnique: boolean;
    duplicates: T[];
    totalItems: number;
    uniqueItems: number;
  } {
    const selector = keySelector || ((item: T) => item);
    const keys = array.map(selector);
    const uniqueKeys = new Set(keys);
    const duplicates = array.filter(
      (item, index) => keys.indexOf(selector(item)) !== index
    );

    return {
      isUnique: uniqueKeys.size === array.length,
      duplicates,
      totalItems: array.length,
      uniqueItems: uniqueKeys.size,
    };
  }

  /**
   * Validate error message contains expected text
   * Returns validation result for use in test assertions
   */
  static validateErrorMessage(
    error: unknown,
    expectedText: string
  ): {
    isError: boolean;
    messageContains: boolean;
    actualMessage?: string;
  } {
    const isError = error instanceof Error;
    const actualMessage = isError ? (error as Error).message : String(error);
    const messageContains = actualMessage.includes(expectedText);

    return {
      isError,
      messageContains,
      actualMessage: isError ? actualMessage : undefined,
    };
  }
}
