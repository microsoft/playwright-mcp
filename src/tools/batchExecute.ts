import type { Context } from '../context.js';
import type { Response } from '../response.js';
import type {
  BatchExecuteOptions,
  BatchResult,
  StepResult,
} from '../types/batch.js';
import { batchExecuteSchema } from '../types/batch.js';
import { getErrorMessage } from '../utils/commonFormatters.js';
import { defineTool } from './tool.js';
export const batchExecuteTool = defineTool({
  capability: 'core',
  schema: {
    name: 'browser_batch_execute',
    title: 'Batch Execute Browser Actions',
    description: `Execute multiple browser actions in sequence with optimized response handling.RECOMMENDED:Use this tool instead of individual actions when performing multiple operations to significantly reduce token usage and improve performance.BY DEFAULT use for:form filling(multiple type→click),multi-step navigation,any workflow with 2+ known steps.Saves 90% tokens vs individual calls.globalExpectation:{includeSnapshot:false,snapshotOptions:{selector:"#app"},diffOptions:{enabled:true}}.Per-step override:steps[].expectation.Example:[{tool:"browser_navigate",arguments:{url:"https://example.com"}},{tool:"browser_type",arguments:{element:"username",ref:"#user",text:"john"}},{tool:"browser_click",arguments:{element:"submit",ref:"#btn"}}].`,
    inputSchema: batchExecuteSchema,
    type: 'destructive',
  },
  handle: async (context, params: BatchExecuteOptions, response) => {
    try {
      const batchExecutor = getBatchExecutorOrError(context, response);
      if (!batchExecutor) {
        return;
      }

      const result: BatchResult = await batchExecutor.execute(params);

      processExecutionResult(result, response);
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      response.addError(`Batch execution failed: ${errorMessage}`);
    }
  },
});

/**
 * Get batch executor or add error to response
 */
function getBatchExecutorOrError(context: Context, response: Response) {
  const batchExecutor = context.getBatchExecutor();
  if (!batchExecutor) {
    response.addError(
      'Batch executor not available. Please ensure the browser context is properly initialized.'
    );
    return null;
  }
  return batchExecutor;
}

/**
 * Process batch execution result and add to response
 */
function processExecutionResult(result: BatchResult, response: Response): void {
  response.addResult(formatBatchResult(result));

  if (result.steps.length > 0) {
    addStepDetails(result, response);
  }

  addFinalStateIfNeeded(result, response);
  handleExecutionErrors(result, response);
}

/**
 * Add detailed step information to response
 */
function addStepDetails(result: BatchResult, response: Response): void {
  response.addResult('');
  response.addResult('### Step Details');

  for (const stepResult of result.steps) {
    addStepResult(stepResult, response);
  }
}

/**
 * Add individual step result to response
 */
function addStepResult(stepResult: StepResult, response: Response): void {
  const status = stepResult.success ? '✅' : '❌';
  const duration = `${stepResult.executionTimeMs}ms`;
  response.addResult(
    `${status} Step ${stepResult.stepIndex + 1}: ${stepResult.toolName} (${duration})`
  );

  if (stepResult.success && stepResult.result) {
    addSuccessfulStepContent(stepResult, response);
  } else if (!stepResult.success && stepResult.error) {
    response.addResult(`   Error: ${stepResult.error}`);
  }
}

/**
 * Add content from successful step
 */
function addSuccessfulStepContent(
  stepResult: StepResult,
  response: Response
): void {
  const stepContent = stepResult.result as {
    content?: Array<{ text?: string }>;
  };
  const textContent = stepContent.content?.[0]?.text;

  if (typeof textContent === 'string') {
    const lines = textContent.split('\n').slice(0, 3);
    response.addResult(`   ${lines.join('\n   ')}`);
    if (textContent.split('\n').length > 3) {
      response.addResult('   ...');
    }
  }
}

/**
 * Add final state information if needed
 */
function addFinalStateIfNeeded(result: BatchResult, response: Response): void {
  const successfulStepsWithContent = getSuccessfulStepsWithContent(result);

  if (
    successfulStepsWithContent.length > 0 &&
    result.stopReason === 'completed'
  ) {
    response.addResult('');
    response.addResult('### Final State');

    const lastStep = successfulStepsWithContent.at(-1);
    const finalContent = extractFinalStepContent(lastStep);

    if (finalContent) {
      response.addResult(finalContent);
    }
  }
}

/**
 * Get successful steps with content
 */
function getSuccessfulStepsWithContent(result: BatchResult) {
  return result.steps.filter(
    (s) =>
      s.success &&
      s.result &&
      typeof s.result === 'object' &&
      'content' in s.result &&
      Array.isArray(s.result.content) &&
      s.result.content[0]?.text &&
      !('isError' in s.result && s.result.isError)
  );
}

/**
 * Extract content from final step
 */
function extractFinalStepContent(
  lastStep: StepResult | undefined
): string | null {
  if (
    lastStep?.result &&
    typeof lastStep.result === 'object' &&
    'content' in lastStep.result &&
    Array.isArray(lastStep.result.content) &&
    lastStep.result.content[0]?.text
  ) {
    return lastStep.result.content[0].text;
  }
  return null;
}

/**
 * Handle execution errors
 */
function handleExecutionErrors(result: BatchResult, response: Response): void {
  if (result.stopReason === 'error' || result.failedSteps > 0) {
    const errorMessage =
      result.stopReason === 'error'
        ? 'stopped due to error'
        : 'completed with failures';
    response.addError(`Batch execution ${errorMessage}`);
  }
}

/**
 * Formats batch execution result for display
 */
function formatBatchResult(result: BatchResult): string {
  const lines: string[] = [];
  lines.push('### Batch Execution Summary');
  lines.push(`- Status: ${getStatusDisplay(result.stopReason)}`);
  lines.push(`- Total Steps: ${result.totalSteps}`);
  lines.push(`- Successful: ${result.successfulSteps}`);
  lines.push(`- Failed: ${result.failedSteps}`);
  lines.push(`- Total Time: ${result.totalExecutionTimeMs}ms`);
  if (result.stopReason === 'error') {
    lines.push('- Note: Execution stopped early due to error');
  }
  return lines.join('\n');
}
/**
 * Gets display string for stop reason
 */
function getStatusDisplay(stopReason: BatchResult['stopReason']): string {
  switch (stopReason) {
    case 'completed':
      return '✅ Completed';
    case 'error':
      return '❌ Stopped on Error';
    case 'stopped':
      return '⏹️ Stopped';
    default:
      return '❓ Unknown';
  }
}
