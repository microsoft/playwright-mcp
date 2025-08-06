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

import { defineTool } from './tool.js';
import { batchExecuteSchema } from '../types/batch.js';
import type { BatchExecuteOptions, BatchResult } from '../types/batch.js';

export const batchExecuteTool = defineTool({
  capability: 'core',
  schema: {
    name: 'browser_batch_execute',
    title: 'Batch Execute Browser Actions',
    description: 'Execute multiple browser actions in sequence with optimized response handling. RECOMMENDED: Use this tool instead of individual actions when performing multiple operations to significantly reduce token usage and improve performance. Example: [{ tool: "browser_navigate", arguments: { url: "https://example.com", expectation: { includeSnapshot: false } } }, { tool: "browser_click", arguments: { element: "login button", ref: "ref123" } }]. Set globalExpectation: { includeSnapshot: false } for maximum efficiency when intermediate states aren\'t needed.',
    inputSchema: batchExecuteSchema,
    type: 'destructive'
  },
  handle: async (context, params: BatchExecuteOptions, response) => {
    try {
      // Get or create batch executor from context
      const batchExecutor = context.getBatchExecutor?.();
      if (!batchExecutor) {
        response.addError('Batch executor not available. Please ensure the browser context is properly initialized.');
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

          response.addResult(`${status} Step ${stepResult.stepIndex + 1}: ${stepResult.toolName} (${duration})`);

          if (stepResult.success && stepResult.result) {
            // Add successful step content if available
            const stepContent = stepResult.result.content?.[0]?.text;
            if (stepContent) {
              const lines = stepContent.split('\n').slice(0, 3); // Show first 3 lines
              response.addResult(`   ${lines.join('\n   ')}`);
              if (stepContent.split('\n').length > 3)
                response.addResult('   ...');

            }
          } else if (!stepResult.success && stepResult.error) {
            response.addResult(`   Error: ${stepResult.error}`);
          }
        }
      }

      // Add aggregated information from successful steps if any had content
      const successfulStepsWithContent = result.steps.filter(s =>
        s.success &&
        s.result?.content?.[0]?.text &&
        !s.result.isError
      );

      if (successfulStepsWithContent.length > 0 && result.stopReason === 'completed') {
        response.addResult('');
        response.addResult('### Final State');

        // Use content from the last successful step that had meaningful output
        const lastStep = successfulStepsWithContent[successfulStepsWithContent.length - 1];
        if (lastStep.result?.content?.[0]?.text)
          response.addResult(lastStep.result.content[0].text);

      }

      // Mark as error if batch failed
      if (result.stopReason === 'error' || result.failedSteps > 0)
        response.addError(`Batch execution ${result.stopReason === 'error' ? 'stopped due to error' : 'completed with failures'}`);


    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      response.addError(`Batch execution failed: ${errorMessage}`);
    }
  }
});

/**
 * Formats batch execution result for display
 */
function formatBatchResult(result: BatchResult): string {
  const lines = [];

  lines.push(`### Batch Execution Summary`);
  lines.push(`- Status: ${getStatusDisplay(result.stopReason)}`);
  lines.push(`- Total Steps: ${result.totalSteps}`);
  lines.push(`- Successful: ${result.successfulSteps}`);
  lines.push(`- Failed: ${result.failedSteps}`);
  lines.push(`- Total Time: ${result.totalExecutionTimeMs}ms`);

  if (result.stopReason === 'error')
    lines.push(`- Note: Execution stopped early due to error`);


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
