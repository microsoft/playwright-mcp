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
import { defineTool, type ToolFactory } from './tool.js';

const wait: ToolFactory = captureSnapshot => defineTool({
  capability: 'wait',

  schema: {
    name: 'browser_wait_for',
    title: 'Wait for',
    description: 'Wait for text to appear or disappear or a specified time to pass',
    inputSchema: z.object({
      time: z.number().optional().describe('The time to wait in seconds'),
      text: z.string().optional().describe('The text to wait for'),
      textGone: z.string().optional().describe('The text to wait for to disappear'),
    }),
    type: 'readOnly',
  },

  handle: async (context, params) => {
    if (!params.text && !params.textGone && !params.time)
      throw new Error('Either time, text or textGone must be provided');

    const code: string[] = [];

    if (params.time) {
      code.push(`await new Promise(f => setTimeout(f, ${params.time!} * 1000));`);
      await new Promise(f => setTimeout(f, Math.min(10000, params.time! * 1000)));
    }

    const tab = context.currentTabOrDie();
    const locator = params.text ? tab.page.getByText(params.text).first() : undefined;
    const goneLocator = params.textGone ? tab.page.getByText(params.textGone).first() : undefined;

    if (goneLocator) {
      code.push(`await page.getByText(${JSON.stringify(params.textGone)}).first().waitFor({ state: 'hidden' });`);
      await goneLocator.waitFor({ state: 'hidden' });
    }

    if (locator) {
      code.push(`await page.getByText(${JSON.stringify(params.text)}).first().waitFor({ state: 'visible' });`);
      await locator.waitFor({ state: 'visible' });
    }

    return {
      code,
      captureSnapshot,
      waitForNetwork: false,
    };
  },
});

const close = defineTool({
  capability: 'core',

  schema: {
    name: 'browser_close',
    title: 'Close browser',
    description: 'Close the page',
    inputSchema: z.object({}),
    type: 'readOnly',
  },

  handle: async context => {
    await context.close();
    return {
      code: [`// Internal to close the page`],
      captureSnapshot: false,
      waitForNetwork: false,
    };
  },
});

const resize: ToolFactory = captureSnapshot => defineTool({
  capability: 'core',
  schema: {
    name: 'browser_resize',
    title: 'Resize browser window',
    description: 'Resize the browser window',
    inputSchema: z.object({
      width: z.number().describe('Width of the browser window'),
      height: z.number().describe('Height of the browser window'),
    }),
    type: 'readOnly',
  },

  handle: async (context, params) => {
    const tab = context.currentTabOrDie();

    const code = [
      `// Resize browser window to ${params.width}x${params.height}`,
      `await page.setViewportSize({ width: ${params.width}, height: ${params.height} });`
    ];

    const action = async () => {
      await tab.page.setViewportSize({ width: params.width, height: params.height });
    };

    return {
      code,
      action,
      captureSnapshot,
      waitForNetwork: true
    };
  },
});

export default (captureSnapshot: boolean) => [
  close,
  wait(captureSnapshot),
  resize(captureSnapshot)
];
