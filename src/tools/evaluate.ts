import { z } from 'zod';
import { defineTabTool } from './tool.js';
import * as javascript from '../javascript.js';
import { generateLocator } from './utils.js';
import { expectationSchema } from '../schemas/expectation.js';
import type * as playwright from 'playwright';
const evaluateSchema = z.object({
  function: z.string().describe('() => { /* code */ } or (element) => { /* code */ } when element is provided'),
  element: z.string().optional().describe('Human-readable element description used to obtain permission to interact with the element'),
  ref: z.string().optional().describe('Exact target element reference from the page snapshot'),
  expectation: expectationSchema
});
const evaluate = defineTabTool({
  capability: 'core',
  schema: {
    name: 'browser_evaluate',
    title: 'Evaluate JavaScript',
    description: `Evaluate JavaScript expression on page or element.Returns evaluation result.USE CASES:extract data,modify DOM,trigger events.expectation:{includeSnapshot:false} for data extraction,true if modifying page.element+ref to run on specific element.CONSIDER batch_execute for multiple evaluations.`,
    inputSchema: evaluateSchema,
    type: 'destructive',
  },
  handle: async (tab, params, response) => {
    response.setIncludeSnapshot();
    let locator: playwright.Locator | undefined;
    if (params.ref && params.element) {
      locator = await tab.refLocator({ ref: params.ref, element: params.element });
      response.addCode(`await page.${await generateLocator(locator)}.evaluate(${javascript.quote(params.function)});`);
    } else {
      response.addCode(`await page.evaluate(${javascript.quote(params.function)});`);
    }
    await tab.waitForCompletion(async () => {
      const receiver = locator ?? tab.page as any;
      const result = await receiver._evaluateFunction(params.function);
      response.addResult(JSON.stringify(result, null, 2) || 'undefined');
    });
  },
});
export default [
  evaluate,
];
