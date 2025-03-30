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
import { zodToJsonSchema } from 'zod-to-json-schema';
import { CommonToolParams, batchSchema } from './schemas';
import * as common from './common';

import { runAndWait } from './utils';

import type { Tool } from './tool';

export const screenshot: Tool = {
  schema: {
    name: 'browser_screenshot',
    description: 'Take a screenshot of the current page',
    inputSchema: zodToJsonSchema(z.object({})),
  },

  handle: async context => {
    const page = context.existingPage();
    const screenshot = await page.screenshot({ type: 'jpeg', quality: 50, scale: 'css' });
    return {
      content: [{ type: 'image', data: screenshot.toString('base64'), mimeType: 'image/jpeg' }],
    };
  },
};

const elementSchema = z.object({
  element: z.string().describe('Human-readable element description used to obtain permission to interact with the element'),
});

const moveMouseSchema = elementSchema.extend({
  x: z.number().describe('X coordinate'),
  y: z.number().describe('Y coordinate'),
});

export const moveMouse: Tool = {
  schema: {
    name: 'browser_move_mouse',
    description: 'Move mouse to a given position',
    inputSchema: zodToJsonSchema(moveMouseSchema),
  },

  handle: async (context, params) => {
    const validatedParams = moveMouseSchema.parse(params);
    const page = context.existingPage();
    await page.mouse.move(validatedParams.x, validatedParams.y);
    return {
      content: [{ type: 'text', text: `Moved mouse to (${validatedParams.x}, ${validatedParams.y})` }],
    };
  },
};

const clickSchema = elementSchema.extend({
  x: z.number().describe('X coordinate'),
  y: z.number().describe('Y coordinate'),
});

export const click: Tool = {
  schema: {
    name: 'browser_click',
    description: 'Click left mouse button',
    inputSchema: zodToJsonSchema(clickSchema),
  },

  handle: async (context, params) => {
    return await runAndWait(context, 'Clicked mouse', async page => {
      const validatedParams = clickSchema.parse(params);
      await page.mouse.move(validatedParams.x, validatedParams.y);
      await page.mouse.down();
      await page.mouse.up();
    });
  },
};

const dragSchema = elementSchema.extend({
  startX: z.number().describe('Start X coordinate'),
  startY: z.number().describe('Start Y coordinate'),
  endX: z.number().describe('End X coordinate'),
  endY: z.number().describe('End Y coordinate'),
});

export const drag: Tool = {
  schema: {
    name: 'browser_drag',
    description: 'Drag left mouse button',
    inputSchema: zodToJsonSchema(dragSchema),
  },

  handle: async (context, params) => {
    const validatedParams = dragSchema.parse(params);
    return await runAndWait(context, `Dragged mouse from (${validatedParams.startX}, ${validatedParams.startY}) to (${validatedParams.endX}, ${validatedParams.endY})`, async page => {
      await page.mouse.move(validatedParams.startX, validatedParams.startY);
      await page.mouse.down();
      await page.mouse.move(validatedParams.endX, validatedParams.endY);
      await page.mouse.up();
    });
  },
};

const typeSchema = z.object({
  text: z.string().describe('Text to type into the element'),
  submit: z.boolean().describe('Whether to submit entered text (press Enter after)'),
});

export const type: Tool = {
  schema: {
    name: 'browser_type',
    description: 'Type text',
    inputSchema: zodToJsonSchema(typeSchema),
  },

  handle: async (context, params) => {
    const validatedParams = typeSchema.parse(params);
    return await runAndWait(context, `Typed text "${validatedParams.text}"`, async page => {
      await page.keyboard.type(validatedParams.text);
      if (validatedParams.submit)
        await page.keyboard.press('Enter');
    });
  },
};

// Define vision-specific tool params
export const screenshotParams = z.discriminatedUnion('name', [
  z.object({
    name: z.literal('browser_screenshot'),
    params: z.object({})
  }),
  z.object({
    name: z.literal('browser_click'),
    params: clickSchema
  }),
  z.object({
    name: z.literal('browser_move_mouse'),
    params: moveMouseSchema
  }),
  z.object({
    name: z.literal('browser_drag'),
    params: dragSchema
  }),
  z.object({
    name: z.literal('browser_type'),
    params: typeSchema
  })
]);

// Combine with common tools
const ScreenshotStepSchema = z.union([CommonToolParams, screenshotParams]);

const screenshotBatchSchema = batchSchema.extend({
  input: z.object({
    test_cases: z.array(z.object({
      definition: z.string(),
      steps: z.array(ScreenshotStepSchema)
    }))
  })
});

export const batch: Tool = {
  schema: {
    name: 'browser_batch_process',
    description: 'Run a bunch of steps in vision mode',
    inputSchema: zodToJsonSchema(screenshotBatchSchema)
  },
  handle: async (context, params) => {
    const validatedParams = screenshotBatchSchema.parse(params);
    const results = [];

    for (const testCase of validatedParams.input.test_cases) {
      for (const step of testCase.steps as Array<{ name: string; params: any }>) {
        let tool: Tool;
        
        switch (step.name) {
          case 'browser_navigate':
            tool = common.navigate(false);
            break;
          case 'browser_screenshot':
            tool = screenshot;
            break;
          case 'browser_click':
            tool = click;
            break;
          case 'browser_move_mouse':
            tool = moveMouse;
            break;
          case 'browser_drag':
            tool = drag;
            break;
          case 'browser_type':
            tool = type;
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
            tool = common.goBack(false);
            break;
          case 'browser_go_forward':
            tool = common.goForward(false);
            break;
          default:
            throw new Error(`Unknown tool for vision mode: ${(step.name as string)}`);
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
