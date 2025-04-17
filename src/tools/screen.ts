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

import * as javascript from '../javascript';

import type { Tool } from './tool';

const screenshot: Tool = {
  capability: 'core',
  schema: {
    name: 'browser_screen_capture',
    description: 'Take a screenshot of the current page',
    inputSchema: zodToJsonSchema(z.object({})),
  },

  handle: async context => {
    const tab = await context.ensureTab();
    const options = { type: 'jpeg' as 'jpeg', quality: 50, scale: 'css' as 'css' };

    const code = [
      `// Take a screenshot of the current page`,
      `await page.screenshot(${javascript.formatObject(options)});`,
    ];

    const action = () => tab.page.screenshot(options).then(buffer => {
      return {
        content: [{ type: 'image' as 'image', data: buffer.toString('base64'), mimeType: 'image/jpeg' }],
      };
    });

    return {
      code,
      action,
      captureSnapshot: false,
      waitForNetwork: false
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

const moveMouse: Tool = {
  capability: 'core',
  schema: {
    name: 'browser_screen_move_mouse',
    description: 'Move mouse to a given position',
    inputSchema: zodToJsonSchema(moveMouseSchema),
  },

  handle: async (context, params) => {
    const validatedParams = moveMouseSchema.parse(params);
    const tab = context.currentTabOrDie();
    const code = [
      `// Move mouse to (${validatedParams.x}, ${validatedParams.y})`,
      `await page.mouse.move(${validatedParams.x}, ${validatedParams.y});`,
    ];
    const action = () => tab.page.mouse.move(validatedParams.x, validatedParams.y);
    return {
      code,
      action,
      captureSnapshot: false,
      waitForNetwork: false
    };
  },
};

const clickSchema = elementSchema.extend({
  x: z.number().describe('X coordinate'),
  y: z.number().describe('Y coordinate'),
});

const click: Tool = {
  capability: 'core',
  schema: {
    name: 'browser_screen_click',
    description: 'Click left mouse button',
    inputSchema: zodToJsonSchema(clickSchema),
  },

  handle: async (context, params) => {
    const validatedParams = clickSchema.parse(params);
    const tab = context.currentTabOrDie();
    const code = [
      `// Click mouse at coordinates (${validatedParams.x}, ${validatedParams.y})`,
      `await page.mouse.move(${validatedParams.x}, ${validatedParams.y});`,
      `await page.mouse.down();`,
      `await page.mouse.up();`,
    ];
    const action = async () => {
      await tab.page.mouse.move(validatedParams.x, validatedParams.y);
      await tab.page.mouse.down();
      await tab.page.mouse.up();
    };
    return {
      code,
      action,
      captureSnapshot: false,
      waitForNetwork: true,
    };
  },
};

const dragSchema = elementSchema.extend({
  startX: z.number().describe('Start X coordinate'),
  startY: z.number().describe('Start Y coordinate'),
  endX: z.number().describe('End X coordinate'),
  endY: z.number().describe('End Y coordinate'),
});

const drag: Tool = {
  capability: 'core',

  schema: {
    name: 'browser_screen_drag',
    description: 'Drag left mouse button',
    inputSchema: zodToJsonSchema(dragSchema),
  },

  handle: async (context, params) => {
    const validatedParams = dragSchema.parse(params);
    const tab = context.currentTabOrDie();

    const code = [
      `// Drag mouse from (${validatedParams.startX}, ${validatedParams.startY}) to (${validatedParams.endX}, ${validatedParams.endY})`,
      `await page.mouse.move(${validatedParams.startX}, ${validatedParams.startY});`,
      `await page.mouse.down();`,
      `await page.mouse.move(${validatedParams.endX}, ${validatedParams.endY});`,
      `await page.mouse.up();`,
    ];

    const action = async () => {
      await tab.page.mouse.move(validatedParams.startX, validatedParams.startY);
      await tab.page.mouse.down();
      await tab.page.mouse.move(validatedParams.endX, validatedParams.endY);
      await tab.page.mouse.up();
    };

    return {
      code,
      action,
      captureSnapshot: false,
      waitForNetwork: true,
    };
  },
};

const typeSchema = z.object({
  text: z.string().describe('Text to type into the element'),
  submit: z.boolean().optional().describe('Whether to submit entered text (press Enter after)'),
});

const type: Tool = {
  capability: 'core',

  schema: {
    name: 'browser_screen_type',
    description: 'Type text',
    inputSchema: zodToJsonSchema(typeSchema),
  },

  handle: async (context, params) => {
    const validatedParams = typeSchema.parse(params);
    const tab = context.currentTabOrDie();

    const code = [
      `// Type ${validatedParams.text}`,
      `await page.keyboard.type('${validatedParams.text}');`,
    ];

    const action = async () => {
      await tab.page.keyboard.type(validatedParams.text);
      if (validatedParams.submit)
        await tab.page.keyboard.press('Enter');
    };

    if (validatedParams.submit) {
      code.push(`// Submit text`);
      code.push(`await page.keyboard.press('Enter');`);
    }

    return {
      code,
      action,
      captureSnapshot: false,
      waitForNetwork: true,
    };
  },
};

export default [
  screenshot,
  moveMouse,
  click,
  drag,
  type,
];
