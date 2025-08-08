import type { BatchExecuteOptions, BatchResult } from '../types/batch.js';
import { batchExecuteSchema } from '../types/batch.js';
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
      // Get or create batch executor from context
      const batchExecutor = context.getBatchExecutor();
      if (!batchExecutor) {
        response.addError(
          'Batch executor not available. Please ensure the browser context is properly initialized.'
        );
        return;
      }
      // Execute the batch
      const result: BatchResult = await batchExecutor.execute(params);
      // Format and add result to response
      response.addResult(formatBatchResult(result));
      // Add detailed step information
      if (result.steps.length > 0) {
        response.addResult('');
        response.addResult('### Step Details');
        for (const stepResult of result.steps) {
          const status = stepResult.success ? '✅' : '❌';
          const duration = `${stepResult.executionTimeMs}ms`;
          response.addResult(
            `${status} Step ${stepResult.stepIndex + 1}: ${stepResult.toolName} (${duration})`
          );
          if (stepResult.success && stepResult.result) {
            // Add successful step content if available
            const result = stepResult.result as {
              content?: Array<{ text?: string }>;
            };
            const stepContent = result.content?.[0]?.text;
            if (typeof stepContent === 'string') {
              const lines = stepContent.split('\n').slice(0, 3); // Show first 3 lines
              response.addResult(`   ${lines.join('\n   ')}`);
              if (stepContent.split('\n').length > 3) {
                response.addResult('   ...');
              }
            }
          } else if (!stepResult.success && stepResult.error) {
            response.addResult(`   Error: ${stepResult.error}`);
          }
        }
      }
      // Add aggregated information from successful steps if any had content
      const successfulStepsWithContent = result.steps.filter(
        (s) =>
          s.success &&
          s.result &&
          typeof s.result === 'object' &&
          'content' in s.result &&
          Array.isArray(s.result.content) &&
          s.result.content[0]?.text &&
          !('isError' in s.result && s.result.isError)
      );
      if (
        successfulStepsWithContent.length > 0 &&
        result.stopReason === 'completed'
      ) {
        response.addResult('');
        response.addResult('### Final State');
        // Use content from the last successful step that had meaningful output
        const lastStep = successfulStepsWithContent.at(-1);
        if (
          lastStep?.result &&
          typeof lastStep.result === 'object' &&
          'content' in lastStep.result &&
          Array.isArray(lastStep.result.content) &&
          lastStep.result.content[0]?.text
        ) {
          response.addResult(lastStep.result.content[0].text);
        }
      }
      // Mark as error if batch failed
      if (result.stopReason === 'error' || result.failedSteps > 0) {
        response.addError(
          `Batch execution ${result.stopReason === 'error' ? 'stopped due to error' : 'completed with failures'}`
        );
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      response.addError(`Batch execution failed: ${errorMessage}`);
    }
  },
});
/**
 * Formats batch execution result for display
 */
function formatBatchResult(result: BatchResult): string {
  const lines = [];
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
