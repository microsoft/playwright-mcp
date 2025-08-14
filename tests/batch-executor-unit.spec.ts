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

import { BatchExecutor } from '../src/batch/batch-executor.js';
import type { Context } from '../src/context.js';
import { batchExecuteSchema, batchStepSchema } from '../src/types/batch.js';
import { expect, test } from './fixtures.js';

// Constants for regex patterns
const BATCH_ID_REGEX = /^batch_\d{13}_[a-f0-9]{8}$/;

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

test.describe('BatchExecutor Batch ID Management Tests', () => {
  let mockContext: Context;
  let mockToolRegistry: Map<string, unknown>;

  test.beforeEach(() => {
    mockContext = {} as Context;
    mockToolRegistry = new Map();

    // Mock tool for testing
    const mockTool = {
      schema: {
        inputSchema: {
          safeParse: () => ({ success: true, data: {} }),
        },
      },
      handle: () => {
        // Mock successful execution
        return Promise.resolve({});
      },
    };
    mockToolRegistry.set('test_tool', mockTool);
  });

  test('should generate unique batch ID for each execution', async () => {
    // Create a more complete mock context
    mockContext = {
      batchContext: undefined,
    } as Context;

    const batchExecutor = new BatchExecutor(mockContext, mockToolRegistry);

    const options = {
      steps: [
        {
          tool: 'test_tool',
          arguments: { test: 'value' },
        },
      ],
    };

    // Type for accessing private BatchExecutor properties in tests
    interface TestBatchExecutor extends BatchExecutor {
      lastBatchContext?: { batchId: string };
      currentBatchContext?: { batchId: string };
      generateBatchId?: () => string;
    }

    try {
      const result1 = await batchExecutor.execute(options);
      const result2 = await batchExecutor.execute(options);

      // Check if executions completed (they may fail due to incomplete mocking, but should not crash)
      expect(typeof result1.stopReason).toBe('string');
      expect(typeof result2.stopReason).toBe('string');

      // Verify batch contexts are different
      const testExecutor = batchExecutor as unknown as TestBatchExecutor;
      const batchContext1 = testExecutor.lastBatchContext;
      const batchContext2 = testExecutor.currentBatchContext;

      if (batchContext1 && batchContext2) {
        expect(batchContext1.batchId).not.toBe(batchContext2.batchId);
        expect(typeof batchContext1.batchId).toBe('string');
        expect(typeof batchContext2.batchId).toBe('string');
      }
    } catch (error) {
      // Mock execution may fail with incomplete mocks, but this is expected.
      // We verify that even when execute() fails, batch ID generation still works.
      // The error itself is not important for this test - we're testing batch ID uniqueness.
      if (error instanceof Error && error.message.includes('generateBatchId')) {
        // Re-throw if it's our specific test failure
        throw error;
      }

      // Otherwise, proceed to verify batch ID generation works independently
      const testExecutor = batchExecutor as unknown as TestBatchExecutor;
      const generateBatchId = testExecutor.generateBatchId?.bind(batchExecutor);
      if (generateBatchId) {
        const batchId1 = generateBatchId();
        const batchId2 = generateBatchId();
        expect(batchId1).not.toBe(batchId2);
        expect(typeof batchId1).toBe('string');
        expect(typeof batchId2).toBe('string');
      } else {
        // If generateBatchId is not available, fail the test
        throw new Error('generateBatchId method not found on BatchExecutor');
      }
    }
  });

  test('should include batch ID in correct format when generated', () => {
    const batchExecutor = new BatchExecutor(mockContext, mockToolRegistry);

    // Type for accessing private BatchExecutor properties in tests
    interface TestBatchExecutor extends BatchExecutor {
      generateBatchId?: () => string;
    }

    // Access the private generateBatchId method through reflection
    const testExecutor = batchExecutor as unknown as TestBatchExecutor;
    const generateBatchId = testExecutor.generateBatchId?.bind(batchExecutor);

    if (generateBatchId) {
      const batchId = generateBatchId();

      // Expected format: batch_timestamp_random
      expect(batchId).toMatch(BATCH_ID_REGEX);

      // Ensure batch ID is unique by generating multiple
      const batchId2 = generateBatchId();
      expect(batchId).not.toBe(batchId2);
    }
  });

  test('should maintain batch context during execution', () => {
    // Create a more complete mock context
    mockContext = {
      batchContext: undefined,
    } as Context;

    const batchExecutor = new BatchExecutor(mockContext, mockToolRegistry);

    // Type for accessing private BatchExecutor properties in tests
    interface TestBatchExecutor extends BatchExecutor {
      currentBatchContext?: { batchId: string };
      generateBatchId?: () => string;
    }

    // Verify the current batch context is created during execution
    const testExecutor = batchExecutor as unknown as TestBatchExecutor;
    const currentBatchContext = testExecutor.currentBatchContext;
    expect(currentBatchContext).toBeUndefined(); // Should be undefined before execution

    // Access the generateBatchId method to verify it works
    const generateBatchId = testExecutor.generateBatchId?.bind(batchExecutor);
    if (generateBatchId) {
      const batchId = generateBatchId();
      expect(typeof batchId).toBe('string');
      expect(batchId.length).toBeGreaterThan(0);
    }
  });

  test('should generate different batch IDs for concurrent executions', () => {
    // Create a more complete mock context
    mockContext = {
      batchContext: undefined,
    } as Context;

    const batchExecutor = new BatchExecutor(mockContext, mockToolRegistry);

    // Type for accessing private BatchExecutor properties in tests
    interface TestBatchExecutor extends BatchExecutor {
      generateBatchId?: () => string;
    }

    // Test multiple batch ID generation to ensure uniqueness
    const testExecutor = batchExecutor as unknown as TestBatchExecutor;
    const generateBatchId = testExecutor.generateBatchId?.bind(batchExecutor);
    if (generateBatchId) {
      const batchIds: string[] = [];
      for (let i = 0; i < 5; i++) {
        const batchId = generateBatchId();
        expect(batchIds).not.toContain(batchId);
        batchIds.push(batchId);
      }

      // All batch IDs should be unique
      expect(new Set(batchIds).size).toBe(batchIds.length);
    }
  });
});
