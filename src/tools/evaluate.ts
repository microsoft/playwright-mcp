import type * as playwright from 'playwright';
import { z } from 'zod';
import { expectationSchema } from '../schemas/expectation.js';
import { quote } from '../utils/codegen.js';
import { defineTabTool } from './tool.js';
import { generateLocator } from './utils.js';

const evaluateSchema = z.object({
  function: z
    .string()
    .describe(
      '() => { /* code */ } or (element) => { /* code */ } when element is provided'
    ),
  element: z
    .string()
    .optional()
    .describe(
      'Human-readable element description used to obtain permission to interact with the element'
    ),
  ref: z
    .string()
    .optional()
    .describe(
      'System-generated element ID from previous tool results (e.g., "rNODE-45-1"). Never use custom values.'
    ),
  expectation: expectationSchema,
});
const evaluate = defineTabTool({
  capability: 'core',
  schema: {
    name: 'browser_evaluate',
    title: 'Evaluate JavaScript',
    description:
      'Evaluate JavaScript expression on page or element.Returns evaluation result.USE CASES:extract data,modify DOM,trigger events.expectation:{includeSnapshot:false} for data extraction,true if modifying page.element+ref to run on specific element.CONSIDER batch_execute for multiple evaluations.',
    inputSchema: evaluateSchema,
    type: 'destructive',
  },
  handle: async (tab, params, response) => {
    let locator: playwright.Locator | undefined;
    if (params.ref && params.element) {
      locator = await tab.refLocator({
        ref: params.ref,
        element: params.element,
      });
      response.addCode(
        `await page.${await generateLocator(locator)}.evaluate(${quote(params.function)});`
      );
    } else {
      response.addCode(`await page.evaluate(${quote(params.function)});`);
    }
    await tab.waitForCompletion(async () => {
      try {
        // Use Playwright's internal _evaluateFunction which safely handles string functions
        // This method is used by the upstream microsoft/playwright-mcp implementation
        interface ReceiverWithEvaluate {
          _evaluateFunction(functionString: string): Promise<unknown>;
        }
        const receiver = (locator ??
          tab.page) as unknown as ReceiverWithEvaluate;
        const result = await receiver._evaluateFunction(params.function);
        const stringifiedResult = JSON.stringify(result, null, 2);
        response.addResult(stringifiedResult ?? 'undefined');
      } catch (error) {
        response.addError(
          `JavaScript evaluation failed: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    });
  },
});
export default [evaluate];
