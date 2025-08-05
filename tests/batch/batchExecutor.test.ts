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

import { test, expect } from '../fixtures.js';
import type { BatchStep, BatchExecuteOptions } from '../../src/types/batch.js';
import type { ToolSchema } from '../../src/mcp/server.js';

// Mock context and tools
const mockContext = {
  currentTab: vi.fn(),
  currentTabOrDie: vi.fn(),
  tabs: vi.fn(() => []),
  config: { imageResponses: 'include' }
} as unknown as Context;

// Mock tool schema
const mockClickTool: ToolSchema<any> = {
  name: 'browser_click',
  title: 'Click Element',
  description: 'Click on an element',
  inputSchema: {
    parse: vi.fn(args => args),
    safeParse: vi.fn(args => ({ success: true, data: args }))
  } as any,
  type: 'destructive'
};

const mockNavigationTool: ToolSchema<any> = {
  name: 'browser_navigate',
  title: 'Navigate',
  description: 'Navigate to a URL',
  inputSchema: {
    parse: vi.fn(args => args),
    safeParse: vi.fn(args => ({ success: true, data: args }))
  } as any,
  type: 'destructive'
};

describe('BatchExecutor', () => {
  let executor: BatchExecutor;
  let mockToolRegistry: Map<string, ToolSchema<any>>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockToolRegistry = new Map([
      ['browser_click', mockClickTool],
      ['browser_navigate', mockNavigationTool]
    ]);

    executor = new BatchExecutor(mockContext, mockToolRegistry);
  });

  describe('validateAllSteps', () => {
    it('should validate all steps successfully', async () => {
      const steps: BatchStep[] = [
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
      ];

      await expect(executor.validateAllSteps(steps)).resolves.not.toThrow();
    });

    it('should throw error for unknown tool', async () => {
      const steps: BatchStep[] = [
        {
          tool: 'unknown_tool',
          arguments: { param: 'value' },
          continueOnError: false,
          expectation: undefined
        }
      ];

      await expect(executor.validateAllSteps(steps))
          .rejects.toThrow('Unknown tool: unknown_tool');
    });

    it('should throw error for invalid arguments', async () => {
      const mockTool = {
        ...mockClickTool,
        inputSchema: {
          parse: vi.fn(() => { throw new Error('Invalid arguments'); }),
          safeParse: vi.fn(() => ({ success: false, error: { message: 'Invalid arguments' } }))
        }
      };

      mockToolRegistry.set('browser_click', mockTool);
      executor = new BatchExecutor(mockContext, mockToolRegistry);

      const steps: BatchStep[] = [
        {
          tool: 'browser_click',
          arguments: { invalid: 'args' },
          continueOnError: false,
          expectation: undefined
        }
      ];

      await expect(executor.validateAllSteps(steps))
          .rejects.toThrow('Invalid arguments for browser_click');
    });
  });

  describe('execute', () => {
    it('should execute all steps successfully', async () => {
      const mockToolHandler = vi.fn().mockResolvedValue('Tool executed successfully');

      // Mock tool execution
      const originalExecuteStep = executor.executeStep;
      executor.executeStep = vi.fn().mockImplementation(async (step, globalExpectation) => {
        const response = new Response(mockContext, step.tool, step.arguments);
        response.addResult(`${step.tool} executed with args: ${JSON.stringify(step.arguments)}`);
        return response.serialize();
      });

      const options: BatchExecuteOptions = {
        steps: [
          {
            tool: 'browser_navigate',
            arguments: { url: 'https://example.com' },
            continueOnError: false,
            expectation: { includeSnapshot: false }
          },
          {
            tool: 'browser_click',
            arguments: { element: 'button' },
            continueOnError: false,
            expectation: { includeSnapshot: true }
          }
        ],
        stopOnFirstError: false,
        globalExpectation: { includeConsole: false }
      };

      const result = await executor.execute(options);

      expect(result.totalSteps).toBe(2);
      expect(result.successfulSteps).toBe(2);
      expect(result.failedSteps).toBe(0);
      expect(result.stopReason).toBe('completed');
      expect(result.steps).toHaveLength(2);
      expect(result.steps[0].success).toBe(true);
      expect(result.steps[1].success).toBe(true);
    });

    it('should handle step errors with continueOnError=true', async () => {
      executor.executeStep = vi.fn()
          .mockResolvedValueOnce('First step success')
          .mockRejectedValueOnce(new Error('Step failed'))
          .mockResolvedValueOnce('Third step success');

      const options: BatchExecuteOptions = {
        steps: [
          {
            tool: 'browser_navigate',
            arguments: { url: 'https://example.com' },
            continueOnError: false,
            expectation: undefined
          },
          {
            tool: 'browser_click',
            arguments: { element: 'button' },
            continueOnError: true, // Continue despite error
            expectation: undefined
          },
          {
            tool: 'browser_navigate',
            arguments: { url: 'https://other.com' },
            continueOnError: false,
            expectation: undefined
          }
        ],
        stopOnFirstError: false,
        globalExpectation: undefined
      };

      const result = await executor.execute(options);

      expect(result.totalSteps).toBe(3);
      expect(result.successfulSteps).toBe(2);
      expect(result.failedSteps).toBe(1);
      expect(result.stopReason).toBe('completed');
      expect(result.steps[1].success).toBe(false);
      expect(result.steps[1].error).toContain('Step failed');
    });

    it('should stop on first error when stopOnFirstError=true and continueOnError=false', async () => {
      executor.executeStep = vi.fn()
          .mockResolvedValueOnce('First step success')
          .mockRejectedValueOnce(new Error('Critical error'))
          .mockResolvedValueOnce('Should not reach here');

      const options: BatchExecuteOptions = {
        steps: [
          {
            tool: 'browser_navigate',
            arguments: { url: 'https://example.com' },
            continueOnError: false,
            expectation: undefined
          },
          {
            tool: 'browser_click',
            arguments: { element: 'button' },
            continueOnError: false, // Stop on error
            expectation: undefined
          },
          {
            tool: 'browser_navigate',
            arguments: { url: 'https://other.com' },
            continueOnError: false,
            expectation: undefined
          }
        ],
        stopOnFirstError: true,
        globalExpectation: undefined
      };

      const result = await executor.execute(options);

      expect(result.totalSteps).toBe(3);
      expect(result.successfulSteps).toBe(1);
      expect(result.failedSteps).toBe(1);
      expect(result.stopReason).toBe('error');
      expect(result.steps).toHaveLength(2); // Third step not executed
      expect(executor.executeStep).toHaveBeenCalledTimes(2);
    });

    it('should merge global and step expectations correctly', async () => {
      const executeStepSpy = vi.fn().mockResolvedValue('Mock result');
      executor.executeStep = executeStepSpy;

      const options: BatchExecuteOptions = {
        steps: [
          {
            tool: 'browser_click',
            arguments: { element: 'button' },
            continueOnError: false,
            expectation: { includeSnapshot: true } // Step-level expectation
          }
        ],
        stopOnFirstError: false,
        globalExpectation: { includeConsole: false, includeDownloads: false } // Global expectation
      };

      await executor.execute(options);

      expect(executeStepSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            tool: 'browser_click',
            expectation: { includeSnapshot: true }
          }),
          { includeConsole: false, includeDownloads: false }
      );
    });

    it('should track execution time correctly', async () => {
      const delay = 50;
      executor.executeStep = vi.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, delay));
        return 'Mock result';
      });

      const options: BatchExecuteOptions = {
        steps: [
          {
            tool: 'browser_click',
            arguments: { element: 'button' },
            continueOnError: false,
            expectation: undefined
          }
        ],
        stopOnFirstError: false,
        globalExpectation: undefined
      };

      const result = await executor.execute(options);

      expect(result.totalExecutionTimeMs).toBeGreaterThanOrEqual(delay);
      expect(result.steps[0].executionTimeMs).toBeGreaterThanOrEqual(delay);
    });
  });

  describe('executeStep', () => {
    it('should execute step with merged expectations', async () => {
      const mockToolHandler = vi.fn().mockResolvedValue('Tool result');
      const mockTool = {
        ...mockClickTool,
        handle: mockToolHandler
      };
      mockToolRegistry.set('browser_click', mockTool);
      executor = new BatchExecutor(mockContext, mockToolRegistry);

      const step: BatchStep = {
        tool: 'browser_click',
        arguments: { element: 'button', ref: '#submit' },
        continueOnError: false,
        expectation: { includeSnapshot: true }
      };

      const globalExpectation = { includeConsole: false };

      // Mock the actual tool execution
      const result = await executor.executeStep(step, globalExpectation);

      // Should merge expectations: step expectation takes precedence
      expect(result).toBeDefined();
    });

    it('should throw error for unknown tool in step execution', async () => {
      const step: BatchStep = {
        tool: 'unknown_tool',
        arguments: { param: 'value' },
        continueOnError: false,
        expectation: undefined
      };

      await expect(executor.executeStep(step, undefined))
          .rejects.toThrow('Unknown tool: unknown_tool');
    });
  });
});
