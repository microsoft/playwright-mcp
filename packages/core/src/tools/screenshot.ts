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

import { runAndWait } from '../utils';

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

export const elementVisionSchema = z.object({
  element: z.string().describe('Human-readable element description used to obtain permission to interact with the element'),
});

export const moveMouseSchema = elementVisionSchema.extend({
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

export const clickVisionkSchema = elementVisionSchema.extend({
  x: z.number().describe('X coordinate'),
  y: z.number().describe('Y coordinate'),
});

export const clickVision: Tool = {
  schema: {
    name: 'browser_click',
    description: 'Click left mouse button',
    inputSchema: zodToJsonSchema(clickVisionkSchema),
  },

  handle: async (context, params) => {
    return await runAndWait(context, 'Clicked mouse', async page => {
      const validatedParams = clickVisionkSchema.parse(params);
      await page.mouse.move(validatedParams.x, validatedParams.y);
      await page.mouse.down();
      await page.mouse.up();
    });
  },
};

export const dragVisionkSchema = elementVisionSchema.extend({
  startX: z.number().describe('Start X coordinate'),
  startY: z.number().describe('Start Y coordinate'),
  endX: z.number().describe('End X coordinate'),
  endY: z.number().describe('End Y coordinate'),
});

export const dragVision: Tool = {
  schema: {
    name: 'browser_drag',
    description: 'Drag left mouse button',
    inputSchema: zodToJsonSchema(dragVisionkSchema),
  },

  handle: async (context, params) => {
    const validatedParams = dragVisionkSchema.parse(params);
    return await runAndWait(context, `Dragged mouse from (${validatedParams.startX}, ${validatedParams.startY}) to (${validatedParams.endX}, ${validatedParams.endY})`, async page => {
      await page.mouse.move(validatedParams.startX, validatedParams.startY);
      await page.mouse.down();
      await page.mouse.move(validatedParams.endX, validatedParams.endY);
      await page.mouse.up();
    });
  },
};

export const typeVisionkSchema = z.object({
  text: z.string().describe('Text to type into the element'),
  submit: z.boolean().describe('Whether to submit entered text (press Enter after)'),
});

export const typeVision: Tool = {
  schema: {
    name: 'browser_type',
    description: 'Type text',
    inputSchema: zodToJsonSchema(typeVisionkSchema),
  },

  handle: async (context, params) => {
    const validatedParams = typeVisionkSchema.parse(params);
    return await runAndWait(context, `Typed text "${validatedParams.text}"`, async page => {
      await page.keyboard.type(validatedParams.text);
      if (validatedParams.submit)
        await page.keyboard.press('Enter');
    });
  },
};
