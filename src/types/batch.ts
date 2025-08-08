// @ts-nocheck
import { z } from 'zod';
import { expectationSchema } from '../schemas/expectation.js';

// Helper to parse JSON strings that might be sent by MCP clients
const parseJsonString = (val: unknown): unknown => {
  if (typeof val === 'string') {
    try {
      return JSON.parse(val);
    } catch {
      return val;
    }
  }
  return val;
};
/**
 * Schema for a single step in batch execution
 */
export const batchStepSchema = z.object({
  tool: z.string().describe('Tool name to execute'),
  arguments: z.record(z.unknown()).describe('Arguments for the tool'),
  continueOnError: z
    .boolean()
    .optional()
    .default(false)
    .describe('Continue batch execution if this step fails'),
  expectation: expectationSchema.describe(
    'Expected output configuration for this step'
  ),
});
/**
 * Schema for batch execution configuration
 */
export const batchExecuteSchema = z.object({
  steps: z
    .array(batchStepSchema)
    .min(1)
    .describe('Array of steps to execute in sequence'),
  stopOnFirstError: z
    .boolean()
    .optional()
    .default(false)
    .describe('Stop entire batch on first error'),
  globalExpectation: z
    .preprocess(parseJsonString, expectationSchema)
    .optional()
    .describe('Default expectation for all steps'),
});
export type BatchStep = z.infer<typeof batchStepSchema>;
export type BatchExecuteOptions = z.infer<typeof batchExecuteSchema>;
/**
 * Result of a single step execution
 */
export interface StepResult {
  stepIndex: number;
  toolName: string;
  success: boolean;
  result?: unknown;
  error?: string;
  executionTimeMs: number;
}
/**
 * Result of batch execution
 */
export interface BatchResult {
  steps: StepResult[];
  totalSteps: number;
  successfulSteps: number;
  failedSteps: number;
  totalExecutionTimeMs: number;
  stopReason: 'completed' | 'error' | 'stopped';
}
/**
 * Options for merging step-level and global expectations
 */
export interface ExpectationMergeOptions {
  globalExpectation?: z.infer<typeof expectationSchema>;
  stepExpectation?: z.infer<typeof expectationSchema>;
}
