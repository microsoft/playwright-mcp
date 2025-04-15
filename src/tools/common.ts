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

import type { Tool, ToolFactory } from './tool';

const waitSchema = z.object({
  time: z.number().describe('The time to wait in seconds'),
});

const wait: Tool = {
  capability: 'wait',
  schema: {
    name: 'browser_wait',
    description: 'Wait for a specified time in seconds',
    inputSchema: zodToJsonSchema(waitSchema),
  },
  handle: async (context, params) => {
    const validatedParams = waitSchema.parse(params);
    await new Promise(f => setTimeout(f, Math.min(10000, validatedParams.time * 1000)));
    return {
      content: [{
        type: 'text',
        text: `Waited for ${validatedParams.time} seconds`,
      }],
    };
  },
};

const closeSchema = z.object({});

const close: Tool = {
  capability: 'core',
  schema: {
    name: 'browser_close',
    description: 'Close the page',
    inputSchema: zodToJsonSchema(closeSchema),
  },
  handle: async context => {
    await context.close();
    return {
      content: [{
        type: 'text',
        text: `Page closed`,
      }],
    };
  },
};

const resizeSchema = z.object({
  width: z.number().describe('Width of the browser window'),
  height: z.number().describe('Height of the browser window'),
});

const resize: ToolFactory = captureSnapshot => ({
  capability: 'core',
  schema: {
    name: 'browser_resize',
    description: 'Resize the browser window',
    inputSchema: zodToJsonSchema(resizeSchema),
  },
  handle: async (context, params) => {
    const validatedParams = resizeSchema.parse(params);

    const tab = context.currentTab();
    return await tab.run(async tab => {
      await tab.page.setViewportSize({ width: validatedParams.width, height: validatedParams.height });
      const code = [
        `// Resize browser window to ${validatedParams.width}x${validatedParams.height}`,
        `await page.setViewportSize({ width: ${validatedParams.width}, height: ${validatedParams.height} });`
      ];
      return { code };
    }, {
      captureSnapshot,
    });
  },
});

export default (captureSnapshot: boolean) => [
  close,
  wait,
  resize(captureSnapshot)
];
