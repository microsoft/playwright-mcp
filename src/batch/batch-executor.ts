import type { Context } from '../context.js';
import { Response } from '../response.js';
import type { ExpectationOptions } from '../schemas/expectation.js';
import { mergeExpectations } from '../schemas/expectation.js';
import type { Tool } from '../tools/tool.js';
import type {
  BatchExecuteOptions,
  BatchResult,
  BatchStep,
  StepResult,
} from '../types/batch.js';
import { getErrorMessage } from '../utils/commonFormatters.js';

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
  constructor(context: Context, toolRegistry: Map<string, Tool>) {
    this.context = context;
    this.toolRegistry = toolRegistry;
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
    // Pre-validation phase
    this.validateAllSteps(options.steps);
    // Execution phase
    for (const [index, step] of options.steps.entries()) {
      const stepStartTime = Date.now();
      try {
        // biome-ignore lint/nursery/noAwaitInLoop: Batch steps must be executed sequentially in order
        const result = await this.executeStep(step, options.globalExpectation);
        const stepEndTime = Date.now();
        results.push({
          stepIndex: index,
          toolName: step.tool,
          success: true,
          result,
          executionTimeMs: stepEndTime - stepStartTime,
        });
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
        if (options.stopOnFirstError && !step.continueOnError) {
          stopReason = 'error';
          break;
        }
      }
    }
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
   * @returns Step execution result
   */
  async executeStep(
    step: BatchStep,
    globalExpectation?: ExpectationOptions
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
