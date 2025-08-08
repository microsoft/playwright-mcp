// @ts-nocheck
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

import { batchExecuteSchema, batchStepSchema } from '../src/types/batch.js';
import { expect, test } from './fixtures.js';

test.describe('Batch Execution Schema Tests', () => {
  test('batchStepSchema should validate correct step configuration', () => {
    const validStep = {
      tool: 'browser_navigate',
      arguments: { url: 'https://example.com' },
      continueOnError: false,
      expectation: { includeSnapshot: false },
    };

    const result = batchStepSchema.safeParse(validStep);
    expect(result.success).toBe(true);
  });

  test('batchStepSchema should reject missing tool name', () => {
    const invalidStep = {
      arguments: { url: 'https://example.com' },
      continueOnError: false,
    };

    const result = batchStepSchema.safeParse(invalidStep);
    expect(result.success).toBe(false);
  });

  test('batchStepSchema should provide default values', () => {
    const minimalStep = {
      tool: 'browser_click',
      arguments: { element: 'button' },
    };

    const result = batchStepSchema.safeParse(minimalStep);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.continueOnError).toBe(false);
    }
  });

  test('batchExecuteSchema should validate correct batch configuration', () => {
    const validBatch = {
      steps: [
        {
          tool: 'browser_navigate',
          arguments: { url: 'https://example.com' },
          continueOnError: false,
          expectation: { includeSnapshot: false },
        },
        {
          tool: 'browser_click',
          arguments: { element: 'button', ref: '#submit' },
          continueOnError: true,
          expectation: { includeSnapshot: true },
        },
      ],
      stopOnFirstError: false,
      globalExpectation: { includeConsole: false },
    };

    const result = batchExecuteSchema.safeParse(validBatch);
    expect(result.success).toBe(true);
  });

  test('batchExecuteSchema should reject empty steps array', () => {
    const invalidBatch = {
      steps: [],
      stopOnFirstError: false,
      globalExpectation: undefined,
    };

    const result = batchExecuteSchema.safeParse(invalidBatch);
    expect(result.success).toBe(false);
  });

  test('batchExecuteSchema should provide default values', () => {
    const minimalBatch = {
      steps: [
        {
          tool: 'browser_navigate',
          arguments: { url: 'https://example.com' },
        },
      ],
    };

    const result = batchExecuteSchema.safeParse(minimalBatch);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.stopOnFirstError).toBe(false);
    }
  });

  test('batchExecuteSchema should handle complex expectation configurations', () => {
    const complexBatch = {
      steps: [
        {
          tool: 'browser_navigate',
          arguments: { url: 'https://example.com' },
          expectation: {
            includeSnapshot: true,
            snapshotOptions: {
              selector: '.main-content',
              maxLength: 1000,
              format: 'html' as const,
            },
            includeConsole: true,
            consoleOptions: {
              levels: ['error' as const, 'warn' as const],
              maxMessages: 5,
              patterns: ['error:', 'warning:'],
              removeDuplicates: true,
            },
          },
        },
      ],
      globalExpectation: {
        includeSnapshot: false,
        includeConsole: true,
        imageOptions: {
          quality: 80,
          maxWidth: 1920,
          maxHeight: 1080,
          format: 'jpeg' as const,
        },
      },
    };

    const result = batchExecuteSchema.safeParse(complexBatch);
    expect(result.success).toBe(true);
  });
});
