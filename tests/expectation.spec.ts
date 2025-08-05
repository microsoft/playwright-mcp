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

import { test, expect } from './fixtures.js';
import { expectationSchema, getDefaultExpectation } from '../src/schemas/expectation.js';
import type { ExpectationOptions } from '../src/schemas/expectation.js';

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
        format: 'aria'
      },
      consoleOptions: {
        levels: ['error', 'warn'],
        maxMessages: 5,
        removeDuplicates: false
      },
      imageOptions: {
        quality: 80,
        maxWidth: 1200,
        maxHeight: 800,
        format: 'jpeg'
      }
    };

    const result = expectationSchema.parse(validExpectation);
    expect(result).toEqual(validExpectation);
  });

  test('should use default values for missing options', () => {
    const minimalExpectation = {};
    const result = expectationSchema.parse(minimalExpectation);

    expect(result.includeSnapshot).toBe(true);
    expect(result.includeConsole).toBe(true);
    expect(result.includeDownloads).toBe(true);
    expect(result.includeTabs).toBe(true);
    expect(result.includeCode).toBe(true);
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
        format: 'text' as const
      }
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
        maxMessages: 3
      }
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
        format: 'png' as const
      }
    };

    const result = expectationSchema.parse(expectationWithImage);
    expect(result.imageOptions?.quality).toBe(95);
    expect(result.imageOptions?.maxWidth).toBe(800);
    expect(result.imageOptions?.maxHeight).toBe(600);
    expect(result.imageOptions?.format).toBe('png');
  });

  test('should reject invalid enum values', () => {
    expect(() => {
      expectationSchema.parse({
        snapshotOptions: { format: 'invalid' }
      });
    }).toThrow();

    expect(() => {
      expectationSchema.parse({
        consoleOptions: { levels: ['invalid'] }
      });
    }).toThrow();

    expect(() => {
      expectationSchema.parse({
        imageOptions: { format: 'invalid' }
      });
    }).toThrow();
  });

  test('should reject invalid quality values', () => {
    expect(() => {
      expectationSchema.parse({
        imageOptions: { quality: 0 }
      });
    }).toThrow();

    expect(() => {
      expectationSchema.parse({
        imageOptions: { quality: 101 }
      });
    }).toThrow();
  });
});

test.describe('Default Expectation Configuration', () => {
  test('should return appropriate defaults for navigate tool', () => {
    const defaults = getDefaultExpectation('browser_navigate');
    expect(defaults.includeSnapshot).toBe(true);
    expect(defaults.includeConsole).toBe(true);
    expect(defaults.includeDownloads).toBe(true);
    expect(defaults.includeTabs).toBe(true);
    expect(defaults.includeCode).toBe(true);
  });

  test('should return appropriate defaults for click tool', () => {
    const defaults = getDefaultExpectation('browser_click');
    expect(defaults.includeSnapshot).toBe(true);
    expect(defaults.includeConsole).toBe(false);
    expect(defaults.includeDownloads).toBe(false);
    expect(defaults.includeTabs).toBe(false);
    expect(defaults.includeCode).toBe(true);
  });

  test('should return appropriate defaults for screenshot tool', () => {
    const defaults = getDefaultExpectation('browser_take_screenshot');
    expect(defaults.includeSnapshot).toBe(false);
    expect(defaults.includeConsole).toBe(false);
    expect(defaults.includeDownloads).toBe(false);
    expect(defaults.includeTabs).toBe(false);
    expect(defaults.includeCode).toBe(false);
  });

  test('should return appropriate defaults for evaluate tool', () => {
    const defaults = getDefaultExpectation('browser_evaluate');
    expect(defaults.includeSnapshot).toBe(false);
    expect(defaults.includeConsole).toBe(true);
    expect(defaults.includeDownloads).toBe(false);
    expect(defaults.includeTabs).toBe(false);
    expect(defaults.includeCode).toBe(true);
  });

  test('should return general defaults for unknown tool', () => {
    const defaults = getDefaultExpectation('unknown_tool');
    expect(defaults.includeSnapshot).toBe(true);
    expect(defaults.includeConsole).toBe(true);
    expect(defaults.includeDownloads).toBe(true);
    expect(defaults.includeTabs).toBe(true);
    expect(defaults.includeCode).toBe(true);
  });
});
