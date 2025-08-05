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

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { batchExecuteTool } from '../../src/tools/batchExecute.js';
import { Context } from '../../src/context.js';
import { Response } from '../../src/response.js';
import type { BatchExecuteOptions } from '../../src/types/batch.js';

const mockContext = {
  currentTab: vi.fn(),
  currentTabOrDie: vi.fn(),
  tabs: vi.fn(() => []),
  config: { imageResponses: 'include' }
} as unknown as Context;

describe('batchExecuteTool', () => {
  let mockResponse: Response;

  beforeEach(() => {
    vi.clearAllMocks();
    mockResponse = new Response(mockContext, 'browser_batch_execute', {});
  });

  describe('schema validation', () => {
    it('should validate correct batch execution parameters', () => {
      const validParams: BatchExecuteOptions = {
        steps: [
          {
            tool: 'browser_navigate',
            arguments: { url: 'https://example.com' },
            continueOnError: false,
            expectation: { includeSnapshot: false }
          },
          {
            tool: 'browser_click',
            arguments: { element: 'button', ref: '#submit' },
            continueOnError: true,
            expectation: { includeSnapshot: true }
          }
        ],
        stopOnFirstError: false,
        globalExpectation: { includeConsole: false }
      };

      const result = batchExecuteTool.schema.inputSchema.safeParse(validParams);
      expect(result.success).toBe(true);
    });

    it('should reject empty steps array', () => {
      const invalidParams = {
        steps: [],
        stopOnFirstError: false,
        globalExpectation: undefined
      };

      const result = batchExecuteTool.schema.inputSchema.safeParse(invalidParams);
      expect(result.success).toBe(false);
    });

    it('should reject missing required fields in steps', () => {
      const invalidParams = {
        steps: [
          {
            // Missing 'tool' field
            arguments: { url: 'https://example.com' }
          }
        ],
        stopOnFirstError: false
      };

      const result = batchExecuteTool.schema.inputSchema.safeParse(invalidParams);
      expect(result.success).toBe(false);
    });

    it('should accept minimal valid parameters', () => {
      const minimalParams = {
        steps: [
          {
            tool: 'browser_navigate',
            arguments: { url: 'https://example.com' }
          }
        ]
      };

      const result = batchExecuteTool.schema.inputSchema.safeParse(minimalParams);
      expect(result.success).toBe(true);
    });
  });

  describe('tool properties', () => {
    it('should have correct tool metadata', () => {
      expect(batchExecuteTool.capability).toBe('browser');
      expect(batchExecuteTool.schema.name).toBe('browser_batch_execute');
      expect(batchExecuteTool.schema.title).toBe('Batch Execute Browser Actions');
      expect(batchExecuteTool.schema.description).toContain('Execute multiple browser actions in sequence');
      expect(batchExecuteTool.schema.type).toBe('destructive');
    });
  });

  describe('tool execution', () => {
    it('should handle successful batch execution', async () => {
      const params: BatchExecuteOptions = {
        steps: [
          {
            tool: 'browser_navigate',
            arguments: { url: 'https://example.com' },
            continueOnError: false,
            expectation: { includeSnapshot: false }
          }
        ],
        stopOnFirstError: false,
        globalExpectation: { includeConsole: false }
      };

      // Mock the batch executor to return success
      const mockBatchExecutor = {
        execute: vi.fn().mockResolvedValue({
          steps: [
            {
              stepIndex: 0,
              toolName: 'browser_navigate',
              success: true,
              result: { content: [{ type: 'text', text: 'Navigation successful' }] },
              executionTimeMs: 100
            }
          ],
          totalSteps: 1,
          successfulSteps: 1,
          failedSteps: 0,
          totalExecutionTimeMs: 100,
          stopReason: 'completed'
        })
      };

      // Create a custom context with the mocked batch executor
      const contextWithBatchExecutor = {
        ...mockContext,
        getBatchExecutor: vi.fn().mockReturnValue(mockBatchExecutor)
      } as unknown as Context;

      await expect(
          batchExecuteTool.handle(contextWithBatchExecutor, params, mockResponse)
      ).resolves.not.toThrow();

      expect(mockBatchExecutor.execute).toHaveBeenCalledWith(params);
    });

    it('should handle batch execution with errors', async () => {
      const params: BatchExecuteOptions = {
        steps: [
          {
            tool: 'browser_click',
            arguments: { element: 'nonexistent' },
            continueOnError: false,
            expectation: undefined
          }
        ],
        stopOnFirstError: true,
        globalExpectation: undefined
      };

      const mockBatchExecutor = {
        execute: vi.fn().mockResolvedValue({
          steps: [
            {
              stepIndex: 0,
              toolName: 'browser_click',
              success: false,
              error: 'Element not found',
              executionTimeMs: 50
            }
          ],
          totalSteps: 1,
          successfulSteps: 0,
          failedSteps: 1,
          totalExecutionTimeMs: 50,
          stopReason: 'error'
        })
      };

      const contextWithBatchExecutor = {
        ...mockContext,
        getBatchExecutor: vi.fn().mockReturnValue(mockBatchExecutor)
      } as unknown as Context;

      await expect(
          batchExecuteTool.handle(contextWithBatchExecutor, params, mockResponse)
      ).resolves.not.toThrow();

      expect(mockBatchExecutor.execute).toHaveBeenCalledWith(params);
    });

    it('should handle batch executor initialization failure', async () => {
      const params: BatchExecuteOptions = {
        steps: [
          {
            tool: 'browser_navigate',
            arguments: { url: 'https://example.com' },
            continueOnError: false,
            expectation: undefined
          }
        ],
        stopOnFirstError: false,
        globalExpectation: undefined
      };

      const contextWithoutBatchExecutor = {
        ...mockContext,
        getBatchExecutor: vi.fn().mockReturnValue(null)
      } as unknown as Context;

      await batchExecuteTool.handle(contextWithoutBatchExecutor, params, mockResponse);

      // Should add error to response
      expect(mockResponse.isError()).toBe(true);
    });
  });

  describe('expectation propagation', () => {
    it('should properly handle global and step-level expectations', () => {
      const params: BatchExecuteOptions = {
        steps: [
          {
            tool: 'browser_navigate',
            arguments: { url: 'https://example.com' },
            continueOnError: false,
            expectation: { includeSnapshot: true } // Step-specific expectation
          },
          {
            tool: 'browser_click',
            arguments: { element: 'button' },
            continueOnError: false,
            expectation: undefined // Should use global expectation
          }
        ],
        stopOnFirstError: false,
        globalExpectation: { includeSnapshot: false, includeConsole: true } // Global expectation
      };

      const result = batchExecuteTool.schema.inputSchema.safeParse(params);
      expect(result.success).toBe(true);

      if (result.success) {
        // First step should have step-specific expectation
        expect(result.data.steps[0].expectation).toEqual({ includeSnapshot: true });

        // Second step should inherit from global expectation (handled in executor)
        expect(result.data.steps[1].expectation).toBeUndefined();
        expect(result.data.globalExpectation).toEqual({ includeSnapshot: false, includeConsole: true });
      }
    });
  });
});
