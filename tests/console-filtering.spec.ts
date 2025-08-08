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

test.describe('Console Message Filtering', () => {
  // Mock console messages for testing
  function createMockConsoleMessages() {
    return [
      { type: 'log', toString: () => '[LOG] User logged in successfully' },
      { type: 'warn', toString: () => '[WARN] API rate limit approaching' },
      { type: 'error', toString: () => '[ERROR] Failed to load resource' },
      { type: 'info', toString: () => '[INFO] Application started' },
      { type: 'log', toString: () => '[LOG] User clicked button' },
      { type: 'error', toString: () => '[ERROR] Network timeout' },
      { type: 'log', toString: () => '[LOG] User logged in successfully' }, // Duplicate
      { type: 'warn', toString: () => '[WARN] Deprecated function used' },
      { type: 'log', toString: () => '[LOG] Data saved successfully' },
      { type: 'error', toString: () => '[ERROR] Permission denied' },
    ];
  }

  test('filterConsoleMessages function should exist now', async () => {
    // Now the function should exist
    const { filterConsoleMessages } = await import(
      '../src/utils/consoleFilter.js'
    );
    expect(typeof filterConsoleMessages).toBe('function');
  });

  test('should filter messages by level', async () => {
    const { filterConsoleMessages } = await import(
      '../src/utils/consoleFilter.js'
    );
    const messages = createMockConsoleMessages();
    const options = { levels: ['error'] as const };

    const result = filterConsoleMessages(messages, options);

    expect(result.length).toBe(3); // Should only have error messages
    expect(result.every((msg) => msg.type === 'error')).toBe(true);
    expect(result[0].toString()).toContain('[ERROR]');
  });

  test('should filter messages by pattern matching', async () => {
    const { filterConsoleMessages } = await import(
      '../src/utils/consoleFilter.js'
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
    const { filterConsoleMessages } = await import(
      '../src/utils/consoleFilter.js'
    );
    const messages = createMockConsoleMessages();
    const options = { removeDuplicates: true };

    const result = filterConsoleMessages(messages, options);

    // Original has 10 messages, with 1 duplicate, so should be 9 unique
    expect(result.length).toBe(9);

    // Check that duplicate "User logged in successfully" message is removed
    const loginMessages = result.filter((msg) =>
      msg.toString().includes('User logged in successfully')
    );
    expect(loginMessages.length).toBe(1);
  });

  test('should limit number of messages', async () => {
    const { filterConsoleMessages } = await import(
      '../src/utils/consoleFilter.js'
    );
    const messages = createMockConsoleMessages();
    const options = { maxMessages: 3 };

    const result = filterConsoleMessages(messages, options);

    expect(result.length).toBe(3);
    // Should keep the last 3 messages
    expect(result[2].toString()).toContain('[ERROR] Permission denied');
  });

  test('should handle invalid regex patterns gracefully', async () => {
    const { filterConsoleMessages } = await import(
      '../src/utils/consoleFilter.js'
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
      '../src/utils/consoleFilter.js'
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
  });

  test('should return original messages when no options provided', async () => {
    const { filterConsoleMessages } = await import(
      '../src/utils/consoleFilter.js'
    );
    const messages = createMockConsoleMessages();

    const result = filterConsoleMessages(messages);

    expect(result).toEqual(messages);
    expect(result.length).toBe(messages.length);
  });
});
