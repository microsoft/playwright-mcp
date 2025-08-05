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

import { z } from 'zod';
import { expectationSchema } from '../schemas/expectation.js';

/**
 * Schema for a single step in batch execution
 */
export const batchStepSchema = z.object({
  tool: z.string().describe('Tool name to execute'),
  arguments: z.record(z.any()).describe('Arguments for the tool'),
  continueOnError: z.boolean().optional().default(false).describe('Continue batch execution if this step fails'),
  expectation: expectationSchema.describe('Expected output configuration for this step')
});

/**
 * Schema for batch execution configuration
 */
export const batchExecuteSchema = z.object({
  steps: z.array(batchStepSchema).min(1).describe('Array of steps to execute in sequence'),
  stopOnFirstError: z.boolean().optional().default(false).describe('Stop entire batch on first error'),
  globalExpectation: expectationSchema.describe('Default expectation for all steps')
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
  result?: any;
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
