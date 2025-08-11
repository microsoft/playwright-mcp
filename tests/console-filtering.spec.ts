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

import { expect, test } from '@playwright/test';
import {
  createMockConsoleMessages,
  getFilterFunction,
  testDuplicateRemoval,
  testLevelFiltering,
  testMessageLimit,
} from './helpers/test-utils';

test.describe('Console Message Filtering', () => {
  // Using shared test utilities to reduce duplication

  test('filterConsoleMessages function should exist now', async () => {
    const filterConsoleMessages = await getFilterFunction();
    expect(typeof filterConsoleMessages).toBe('function');
  });

  test('should filter messages by level', async () => {
    const result = await testLevelFiltering(['error'], 3);
    expect(result.length).toBe(3);
    expect(result.every((msg) => msg.type === 'error')).toBe(true);
    expect(result[0].toString()).toContain('[ERROR]');
  });

  test('should filter messages by pattern matching', async () => {
    const { filterConsoleMessages } = await import(
      '../src/utils/console-filter.js'
    );
    const messages = createMockConsoleMessages();
    const options = { patterns: ['User.*logged', 'API.*rate'] };

    const result = filterConsoleMessages(messages, options);

    expect(result.length).toBe(3); // 2 login messages + 1 API rate message
    expect(
      result.some((msg) => msg.toString().includes('User logged in'))
    ).toBe(true);
    expect(
      result.some((msg) => msg.toString().includes('API rate limit'))
    ).toBe(true);
  });

  test('should remove duplicate messages when requested', async () => {
    const result = await testDuplicateRemoval(9);

    expect(result.length).toBe(9);
    // Verify no duplicate messages exist
    const textSet = new Set(result.map((msg) => msg.text));
    expect(textSet.size).toBe(result.length);

    // Check that duplicate "User logged in successfully" message is removed
    const loginMessages = result.filter((msg) =>
      msg.toString().includes('User logged in successfully')
    );
    expect(loginMessages.length).toBe(1);
  });

  test('should limit number of messages', async () => {
    const result = await testMessageLimit(3);
    const messages = createMockConsoleMessages();
    expect(result.length).toBe(Math.min(3, messages.length));
    // Should keep the last 3 messages - the last one should be 'Component mounted'
    expect(result[2].toString()).toContain('[LOG] Component mounted');
  });

  test('should handle invalid regex patterns gracefully', async () => {
    const { filterConsoleMessages } = await import(
      '../src/utils/console-filter.js'
    );
    const messages = createMockConsoleMessages();
    const options = { patterns: ['[invalid regex', 'User'] };

    const result = filterConsoleMessages(messages, options);

    // Should fall back to substring matching for invalid regex
    // Should find messages containing "User"
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((msg) => msg.toString().includes('User'))).toBe(true);
  });

  test('should combine multiple filtering options', async () => {
    const { filterConsoleMessages } = await import(
      '../src/utils/console-filter.js'
    );
    const messages = createMockConsoleMessages();
    const options = {
      levels: ['log', 'error'] as const,
      patterns: ['User.*'],
      removeDuplicates: true,
      maxMessages: 2,
    };

    const result = filterConsoleMessages(messages, options);

    expect(result.length).toBeLessThanOrEqual(2);
    expect(
      result.every((msg) => msg.type && ['log', 'error'].includes(msg.type))
    ).toBe(true);
    expect(result.every((msg) => msg.toString().includes('User'))).toBe(true);

    // If removeDuplicates is true, verify no duplicates
    if (options.removeDuplicates) {
      const textSet = new Set(result.map((msg) => msg.text));
      expect(textSet.size).toBe(result.length);
    }
  });

  test('should return original messages when no options provided', async () => {
    const { filterConsoleMessages } = await import(
      '../src/utils/console-filter.js'
    );
    const messages = createMockConsoleMessages();

    const result = filterConsoleMessages(messages);

    expect(result).toEqual(messages);
    expect(result.length).toBe(messages.length);
  });
});
