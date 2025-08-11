/**
 * Common test utilities to reduce code duplication in test files
 */

import type * as playwright from 'playwright';
import type { ConsoleMessage } from '../../src/tab.js';

/**
 * Create a mock console message with standard toString implementation
 */
function createMockMessage(
  type: string | undefined,
  text: string
): ConsoleMessage {
  return {
    type: type as ReturnType<playwright.ConsoleMessage['type']> | undefined,
    text,
    toString() {
      return `[${this.type?.toUpperCase()}] ${this.text}`;
    },
  };
}

/**
 * Create mock console messages for testing
 */
export function createMockConsoleMessages(): ConsoleMessage[] {
  return [
    createMockMessage('log', 'User logged in successfully'),
    createMockMessage('error', 'Database connection failed'),
    createMockMessage('warn', 'Deprecated API usage detected'),
    createMockMessage('log', 'Page rendered successfully'),
    createMockMessage('error', 'Network request timeout'),
    createMockMessage('info', 'Cache cleared'),
    createMockMessage('log', 'User logged in successfully'), // Duplicate
    createMockMessage('error', 'Authentication failed'),
    createMockMessage('warn', 'API rate limit approaching'),
    createMockMessage('log', 'Component mounted'),
  ];
}

/**
 * Get console filtering function for testing
 */
export async function getFilterFunction() {
  const { filterConsoleMessages } = await import(
    '../../src/utils/console-filter.js'
  );
  return filterConsoleMessages;
}

/**
 * Generic test function for console message filtering
 */
async function testFiltering(options: {
  levels?: readonly string[];
  patterns?: string[];
  removeDuplicates?: boolean;
  maxMessages?: number;
}) {
  const filterConsoleMessages = await getFilterFunction();
  const messages = createMockConsoleMessages();
  const result = filterConsoleMessages(messages, options);
  return result;
}

/**
 * Test filtering by message levels
 */
export async function testLevelFiltering(
  levels: readonly string[],
  _expectedCount: number
) {
  return await testFiltering({ levels: levels as string[] });
}

/**
 * Test filtering by patterns
 */
export async function testPatternFiltering(
  patterns: string[],
  _expectedCount: number
) {
  return await testFiltering({ patterns });
}

/**
 * Test duplicate removal
 */
export async function testDuplicateRemoval(_expectedUniqueCount: number) {
  return await testFiltering({ removeDuplicates: true });
}

/**
 * Test message limit
 */
export async function testMessageLimit(limit: number) {
  return await testFiltering({ maxMessages: limit });
}

/**
 * Test combined filtering options
 */
export async function testCombinedFiltering(
  options: {
    levels?: readonly string[];
    patterns?: string[];
    removeDuplicates?: boolean;
    maxMessages?: number;
  },
  _maxExpectedCount: number
) {
  return await testFiltering(options);
}

/**
 * Check if a value is within expected range
 * Returns validation result for use in test assertions
 */
export function isInRange(value: number, min: number, max: number): boolean {
  return value >= min && value <= max;
}

/**
 * Check if array contains unique items
 * Returns validation result for use in test assertions
 */
export function validateUniqueItems<T>(
  array: T[],
  keySelector?: (item: T) => string | number
): {
  isUnique: boolean;
  duplicates: T[];
  totalItems: number;
  uniqueItems: number;
} {
  const selector = keySelector || ((item: T) => String(item));
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
export function validateErrorMessage(
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
