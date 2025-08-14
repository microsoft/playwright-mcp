import type { Context } from '../context.js';
import { Response } from '../response.js';
import type { ExpectationOptions } from '../schemas/expectation.js';
import { mergeExpectations } from '../schemas/expectation.js';
import type { Tool } from '../tools/tool.js';
import type {
  BatchContext,
  BatchExecuteOptions,
  BatchResult,
  BatchStep,
  StepResult,
} from '../types/batch.js';
import { getErrorMessage } from '../utils/common-formatters.js';

// Type for serialized response content
export interface SerializedResponse {
  content: Array<{ type: string; [key: string]: unknown }>;
  isError?: boolean;
}
/**
 * Executes multiple browser tools in sequence with optimized response handling
 */
export class BatchExecutor {
  private readonly toolRegistry: Map<string, Tool>;
  private readonly context: Context;
  private currentBatchContext?: BatchContext;

  constructor(context: Context, toolRegistry: Map<string, Tool>) {
    this.context = context;
    this.toolRegistry = toolRegistry;
  }

  /**
   * Generates a unique batch ID using crypto for security
   * @returns Unique batch identifier
   */
  private generateBatchId(): string {
    const timestamp = Date.now();
    // Use crypto.getRandomValues for secure random generation (SonarQube compliance)
    const array = new Uint8Array(4);
    crypto.getRandomValues(array);
    const random = Array.from(array, (byte) =>
      byte.toString(16).padStart(2, '0')
    ).join('');
    return `batch_${timestamp}_${random}`;
  }
  /**
   * Validates all steps in the batch before execution
   * @param steps - Array of steps to validate
   */
  validateAllSteps(steps: BatchStep[]): void {
    for (const [index, step] of steps.entries()) {
      const tool = this.toolRegistry.get(step.tool);
      if (!tool) {
        throw new Error(`Unknown tool: ${step.tool}`);
      }
      // Validate arguments using tool's schema
      try {
        const parseResult = tool.schema.inputSchema.safeParse({
          ...step.arguments,
          expectation: step.expectation,
        });
        if (!parseResult.success) {
          throw new Error(`Invalid arguments: ${parseResult.error.message}`);
        }
      } catch (error) {
        throw new Error(
          `Invalid arguments for ${step.tool} at step ${index}: ${getErrorMessage(error)}`
        );
      }
    }
  }
  /**
   * Executes a batch of steps in sequence
   * @param options - Batch execution options
   * @returns Batch execution result
   */
  async execute(options: BatchExecuteOptions): Promise<BatchResult> {
    const results: StepResult[] = [];
    const startTime = Date.now();
    let stopReason: BatchResult['stopReason'] = 'completed';

    // Create batch context
    this.currentBatchContext = {
      batchId: this.generateBatchId(),
      startTime,
    };

    // Pre-validation phase
    this.validateAllSteps(options.steps);

    // Execution phase using recursive approach to avoid await in loop
    const executeSequentially = async (index: number): Promise<void> => {
      if (index >= options.steps.length) {
        return;
      }

      const step = options.steps[index];
      const stepStartTime = Date.now();

      try {
        // Update current step index in batch context
        if (this.currentBatchContext) {
          this.currentBatchContext.currentStepIndex = index;
        }

        const result = await this.executeStep(
          step,
          options.globalExpectation,
          this.currentBatchContext
        );
        const stepEndTime = Date.now();
        results.push({
          stepIndex: index,
          toolName: step.tool,
          success: true,
          result,
          executionTimeMs: stepEndTime - stepStartTime,
        });

        // Continue with next step
        await executeSequentially(index + 1);
      } catch (error) {
        const stepEndTime = Date.now();
        const errorMessage = getErrorMessage(error);
        results.push({
          stepIndex: index,
          toolName: step.tool,
          success: false,
          error: errorMessage,
          executionTimeMs: stepEndTime - stepStartTime,
        });

        // Determine if we should continue or stop
        // Stop unless step explicitly allows continuation
        // This gives step-level continueOnError precedence over global stopOnFirstError
        if (!step.continueOnError) {
          stopReason = 'error';
          return;
        }

        // Continue with next step
        await executeSequentially(index + 1);
      }
    };

    await executeSequentially(0);

    const totalExecutionTime = Date.now() - startTime;
    const successfulSteps = results.filter((r) => r.success).length;
    const failedSteps = results.filter((r) => !r.success).length;
    return {
      steps: results,
      totalSteps: options.steps.length,
      successfulSteps,
      failedSteps,
      totalExecutionTimeMs: totalExecutionTime,
      stopReason,
    };
  }
  /**
   * Executes a single step with merged expectations
   * @param step - Step to execute
   * @param globalExpectation - Global expectation to merge with step expectation
   * @param batchContext - Current batch execution context
   * @returns Step execution result
   */
  async executeStep(
    step: BatchStep,
    globalExpectation?: ExpectationOptions,
    batchContext?: BatchContext
  ): Promise<unknown> {
    const tool = this.toolRegistry.get(step.tool);
    if (!tool) {
      throw new Error(`Unknown tool: ${step.tool}`);
    }
    // Merge expectations: step expectation takes precedence over global
    const mergedExpectation = this.mergeStepExpectations(
      step.tool,
      globalExpectation,
      step.expectation
    );
    // Create arguments with merged expectation
    const argsWithExpectation = {
      ...step.arguments,
      expectation: mergedExpectation,
    };
    // Temporarily set batch context on the main context
    const previousBatchContext = this.context.batchContext;
    this.context.batchContext = batchContext;

    try {
      // Create response instance for this step
      const response = new Response(
        this.context,
        step.tool,
        argsWithExpectation,
        mergedExpectation
      );
      // Execute the tool
      await tool.handle(this.context, argsWithExpectation, response);
      // Finish the response (capture snapshots, etc.)
      await response.finish();
      // Return serialized response
      return response.serialize();
    } finally {
      // Restore previous batch context
      this.context.batchContext = previousBatchContext;
    }
  }
  /**
   * Merges global and step-level expectations
   * @param toolName - Name of the tool being executed
   * @param globalExpectation - Global expectation settings
   * @param stepExpectation - Step-specific expectation settings
   * @returns Merged expectation configuration
   */
  private mergeStepExpectations(
    toolName: string,
    globalExpectation?: ExpectationOptions,
    stepExpectation?: ExpectationOptions
  ): ExpectationOptions {
    // Start with tool defaults
    let merged = mergeExpectations(toolName);
    // Apply global expectation if provided
    if (globalExpectation) {
      merged = mergeExpectations(toolName, {
        ...merged,
        ...globalExpectation,
      });
    }
    // Apply step expectation if provided (highest priority)
    if (stepExpectation) {
      merged = mergeExpectations(toolName, {
        ...merged,
        ...stepExpectation,
      });
    }
    return merged;
  }
}
