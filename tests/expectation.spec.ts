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

import type { ExpectationOptions } from '../src/schemas/expectation.js';
import { expectationSchema } from '../src/schemas/expectation.js';
import { expect, test } from './fixtures.js';
import {
  COMMON_EXPECTATIONS,
  createExpectationTest,
  expectSchemaValidationError,
  testDefaultExpectation,
} from './test-helpers.js';

test.describe('Expectation Schema', () => {
  test('should parse valid expectation options', () => {
    const validExpectation: ExpectationOptions = {
      includeSnapshot: true,
      includeConsole: false,
      includeDownloads: true,
      includeTabs: false,
      includeCode: true,
      snapshotOptions: {
        selector: '.content',
        maxLength: 1000,
        format: 'aria',
      },
      consoleOptions: {
        levels: ['error', 'warn'],
        maxMessages: 5,
        removeDuplicates: false,
      },
      imageOptions: {
        quality: 80,
        maxWidth: 1200,
        maxHeight: 800,
        format: 'jpeg',
      },
    };

    const result = expectationSchema.parse(validExpectation);
    expect(result).toEqual(validExpectation);
  });

  test('should use default values for missing options', () => {
    const minimalExpectation = {};
    createExpectationTest(
      minimalExpectation,
      expect.objectContaining(COMMON_EXPECTATIONS.MINIMAL_RESPONSE)
    );
  });

  test('should parse undefined as valid (optional schema)', () => {
    const result = expectationSchema.parse(undefined);
    expect(result).toBeUndefined();
  });

  test('should validate snapshotOptions correctly', () => {
    const expectationWithSnapshot = {
      snapshotOptions: {
        selector: '#main-content',
        maxLength: 500,
        format: 'text' as const,
      },
    };

    const result = expectationSchema.parse(expectationWithSnapshot);
    expect(result.snapshotOptions?.selector).toBe('#main-content');
    expect(result.snapshotOptions?.maxLength).toBe(500);
    expect(result.snapshotOptions?.format).toBe('text');
  });

  test('should validate consoleOptions correctly', () => {
    const expectationWithConsole = {
      consoleOptions: {
        levels: ['error'] as const,
        maxMessages: 3,
      },
    };

    const result = expectationSchema.parse(expectationWithConsole);
    expect(result.consoleOptions?.levels).toEqual(['error']);
    expect(result.consoleOptions?.maxMessages).toBe(3);
  });

  test('should validate imageOptions correctly', () => {
    const expectationWithImage = {
      imageOptions: {
        quality: 95,
        maxWidth: 800,
        maxHeight: 600,
        format: 'png' as const,
      },
    };

    const result = expectationSchema.parse(expectationWithImage);
    expect(result.imageOptions?.quality).toBe(95);
    expect(result.imageOptions?.maxWidth).toBe(800);
    expect(result.imageOptions?.maxHeight).toBe(600);
    expect(result.imageOptions?.format).toBe('png');
  });

  test('should reject invalid enum values', () => {
    expectSchemaValidationError({ snapshotOptions: { format: 'invalid' } });
    expectSchemaValidationError({ consoleOptions: { levels: ['invalid'] } });
    expectSchemaValidationError({ imageOptions: { format: 'invalid' } });
  });

  test('should reject invalid quality values', () => {
    expectSchemaValidationError({ imageOptions: { quality: 0 } });
    expectSchemaValidationError({ imageOptions: { quality: 101 } });
  });
});

test.describe('Default Expectation Configuration', () => {
  test('should return appropriate defaults for navigate tool', () => {
    testDefaultExpectation(
      'browser_navigate',
      COMMON_EXPECTATIONS.MINIMAL_RESPONSE
    );
  });

  test('should return appropriate defaults for click tool', () => {
    testDefaultExpectation(
      'browser_click',
      COMMON_EXPECTATIONS.MINIMAL_RESPONSE
    );
  });

  test('should return appropriate defaults for screenshot tool', () => {
    testDefaultExpectation(
      'browser_take_screenshot',
      COMMON_EXPECTATIONS.MINIMAL_RESPONSE
    );
  });

  test('should return appropriate defaults for evaluate tool', () => {
    testDefaultExpectation(
      'browser_evaluate',
      COMMON_EXPECTATIONS.MINIMAL_RESPONSE
    );
  });

  test('should return general defaults for unknown tool', () => {
    testDefaultExpectation(
      'unknown_tool',
      COMMON_EXPECTATIONS.MINIMAL_RESPONSE
    );
  });
});
