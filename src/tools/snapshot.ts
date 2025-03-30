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
import zodToJsonSchema from 'zod-to-json-schema';
import { CommonToolParams, batchSchema } from './schemas';
import * as common from './common';

import { captureAriaSnapshot, runAndWait } from './utils';

import type * as playwright from 'playwright';
import type { Tool } from './tool';

export const snapshot: Tool = {
  schema: {
    name: 'browser_snapshot',
    description: 'Capture accessibility snapshot of the current page, this is better than screenshot',
    inputSchema: zodToJsonSchema(z.object({})),
  },

  handle: async context => {
    return await captureAriaSnapshot(context);
  },
};

const elementSchema = z.object({
  element: z.string().describe('Human-readable element description used to obtain permission to interact with the element'),
  ref: z.string().describe('Exact target element reference from the page snapshot'),
});

export const click: Tool = {
  schema: {
    name: 'browser_click',
    description: 'Perform click on a web page',
    inputSchema: zodToJsonSchema(elementSchema),
  },

  handle: async (context, params) => {
    const validatedParams = elementSchema.parse(params);
    return runAndWait(context, `"${validatedParams.element}" clicked`, () => context.refLocator(validatedParams.ref).click(), true);
  },
};

const dragSchema = z.object({
  startElement: z.string().describe('Human-readable source element description used to obtain the permission to interact with the element'),
  startRef: z.string().describe('Exact source element reference from the page snapshot'),
  endElement: z.string().describe('Human-readable target element description used to obtain the permission to interact with the element'),
  endRef: z.string().describe('Exact target element reference from the page snapshot'),
});

export const drag: Tool = {
  schema: {
    name: 'browser_drag',
    description: 'Perform drag and drop between two elements',
    inputSchema: zodToJsonSchema(dragSchema),
  },

  handle: async (context, params) => {
    const validatedParams = dragSchema.parse(params);
    return runAndWait(context, `Dragged "${validatedParams.startElement}" to "${validatedParams.endElement}"`, async () => {
      const startLocator = context.refLocator(validatedParams.startRef);
      const endLocator = context.refLocator(validatedParams.endRef);
      await startLocator.dragTo(endLocator);
    }, true);
  },
};

export const hover: Tool = {
  schema: {
    name: 'browser_hover',
    description: 'Hover over element on page',
    inputSchema: zodToJsonSchema(elementSchema),
  },

  handle: async (context, params) => {
    const validatedParams = elementSchema.parse(params);
    return runAndWait(context, `Hovered over "${validatedParams.element}"`, () => context.refLocator(validatedParams.ref).hover(), true);
  },
};

const typeSchema = elementSchema.extend({
  text: z.string().describe('Text to type into the element'),
  submit: z.boolean().describe('Whether to submit entered text (press Enter after)'),
});

export const type: Tool = {
  schema: {
    name: 'browser_type',
    description: 'Type text into editable element',
    inputSchema: zodToJsonSchema(typeSchema),
  },

  handle: async (context, params) => {
    const validatedParams = typeSchema.parse(params);
    return await runAndWait(context, `Typed "${validatedParams.text}" into "${validatedParams.element}"`, async () => {
      const locator = context.refLocator(validatedParams.ref);
      await locator.fill(validatedParams.text);
      if (validatedParams.submit)
        await locator.press('Enter');
    }, true);
  },
};

const selectOptionSchema = elementSchema.extend({
  values: z.array(z.string()).describe('Array of values to select in the dropdown. This can be a single value or multiple values.'),
});

export const selectOption: Tool = {
  schema: {
    name: 'browser_select_option',
    description: 'Select an option in a dropdown',
    inputSchema: zodToJsonSchema(selectOptionSchema),
  },

  handle: async (context, params) => {
    const validatedParams = selectOptionSchema.parse(params);
    return await runAndWait(context, `Selected option in "${validatedParams.element}"`, async () => {
      const locator = context.refLocator(validatedParams.ref);
      await locator.selectOption(validatedParams.values);
    }, true);
  },
};

function refLocator(page: playwright.Page, ref: string): playwright.Locator {
  return page.locator(`aria-ref=${ref}`);
}

// Define snapshot-specific tool params
export const snapshotParams = z.discriminatedUnion('name', [
  z.object({
    name: z.literal('browser_snapshot'),
    params: z.object({})
  }),
  z.object({
    name: z.literal('browser_click'),
    params: elementSchema
  }),
  z.object({
    name: z.literal('browser_hover'),
    params: elementSchema
  }),
  z.object({
    name: z.literal('browser_type'),
    params: typeSchema.extend({
      element: z.string(),
      ref: z.string()
    })
  }),
  z.object({
    name: z.literal('browser_select_option'),
    params: selectOptionSchema
  })
]);

// Combine with common tools
const SnapshotStepSchema = z.union([CommonToolParams, snapshotParams]);

const snapshotBatchSchema = batchSchema.extend({
  input: z.object({
    test_cases: z.array(z.object({
      definition: z.string(),
      steps: z.array(SnapshotStepSchema)
    }))
  })
});

export const batch: Tool = {
  schema: {
    name: 'browser_batch_snapshot',
    description: 'Run a bunch of steps in snapshot mode',
    inputSchema: zodToJsonSchema(snapshotBatchSchema)
  },
  handle: async (context, params) => {
    const validatedParams = snapshotBatchSchema.parse(params);
    const results = [];

    for (const testCase of validatedParams.input.test_cases) {
      for (const step of testCase.steps as Array<{ name: string; params: any }>) {
        let tool: Tool;
        
        switch (step.name) {
          case 'browser_navigate':
            tool = common.navigate(true);
            break;
          case 'browser_snapshot':
            tool = snapshot;
            break;
          case 'browser_click':
            tool = click;
            break;
          case 'browser_hover':
            tool = hover;
            break;
          case 'browser_type':
            tool = type;
            break;
          case 'browser_select_option':
            tool = selectOption;
            break;
          case 'browser_press_key':
            tool = common.pressKey;
            break;
          case 'browser_wait':
            tool = common.wait;
            break;
          case 'browser_save_as_pdf':
            tool = common.pdf;
            break;
          case 'browser_close':
            tool = common.close;
            break;
          case 'browser_go_back':
            tool = common.goBack(true);
            break;
          case 'browser_go_forward':
            tool = common.goForward(true);
            break;
          default:
            throw new Error(`Unknown tool for snapshot mode: ${step.name}`);
        }

        try {
          const result = await tool.handle(context, step.params);
          results.push({ definition: testCase.definition, step: step.name, result });
        } catch (error) {
          return {
            content: [{ 
              type: 'text', 
              text: `Failed to execute snapshot step "${step.name}": ${error}. Here is the batch tool result: \n${JSON.stringify(results, null, 2)}` 
            }],
            isError: true
          };
        }
      }
    }

    return {
      content: [{ 
        type: 'text', 
        text: `Successfully executed snapshot steps:\n${JSON.stringify(results, null, 2)}` 
      }]
    };
  }
};

const screenshotSchema = z.object({
  raw: z.boolean().optional().describe('Whether to return without compression (in PNG format). Default is false, which returns a JPEG image.'),
});

export const screenshot: Tool = {
  schema: {
    name: 'browser_take_screenshot',
    description: `Take a screenshot of the current page. You can't perform actions based on the screenshot, use browser_snapshot for actions.`,
    inputSchema: zodToJsonSchema(screenshotSchema),
  },

  handle: async (context, params) => {
    const validatedParams = screenshotSchema.parse(params);
    const page = context.existingPage();
    const options: playwright.PageScreenshotOptions = validatedParams.raw ? { type: 'png', scale: 'css' } : { type: 'jpeg', quality: 50, scale: 'css' };
    const screenshot = await page.screenshot(options);
    return {
      content: [{ type: 'image', data: screenshot.toString('base64'), mimeType: validatedParams.raw ? 'image/png' : 'image/jpeg' }],
    };
  },
};
