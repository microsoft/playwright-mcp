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

import os from 'os';
import path from 'path';

import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

import { captureAriaSnapshot, runAndWait } from './utils';

import type { ToolFactory, Tool } from './tool';

const navigateSchema = z.object({
  url: z.string().describe('The URL to navigate to'),
  restoreState: z.boolean().optional().describe('Whether to restore the saved state of the page'),
});

export const navigate: ToolFactory = snapshot => ({
  schema: {
    name: 'browser_navigate',
    description: 'Navigate to a URL',
    inputSchema: zodToJsonSchema(navigateSchema),
  },
  handle: async (context, params) => {
    const validatedParams = navigateSchema.parse(params);
    const page = await context.navigate(validatedParams.url, validatedParams.restoreState);
    if (snapshot)
      return captureAriaSnapshot(page);
    return {
      content: [{
        type: 'text',
        text: `Navigated to ${validatedParams.url}`,
      }],
    };
  },
});

const goBackSchema = z.object({});

export const goBack: ToolFactory = snapshot => ({
  schema: {
    name: 'browser_go_back',
    description: 'Go back to the previous page',
    inputSchema: zodToJsonSchema(goBackSchema),
  },
  handle: async context => {
    return await runAndWait(context, 'Navigated back', page => page.goBack(), snapshot);
  },
});

const goForwardSchema = z.object({});

export const goForward: ToolFactory = snapshot => ({
  schema: {
    name: 'browser_go_forward',
    description: 'Go forward to the next page',
    inputSchema: zodToJsonSchema(goForwardSchema),
  },
  handle: async context => {
    return await runAndWait(context, 'Navigated forward', page => page.goForward(), snapshot);
  },
});

const waitSchema = z.object({
  time: z.number().describe('The time to wait in seconds'),
});

export const wait: Tool = {
  schema: {
    name: 'browser_wait',
    description: 'Wait for a specified time in seconds',
    inputSchema: zodToJsonSchema(waitSchema),
  },
  handle: async (context, params) => {
    const validatedParams = waitSchema.parse(params);
    const page = await context.existingPage();
    await page.waitForTimeout(Math.min(10000, validatedParams.time * 1000));
    return {
      content: [{
        type: 'text',
        text: `Waited for ${validatedParams.time} seconds`,
      }],
    };
  },
};

const pressKeySchema = z.object({
  key: z.string().describe('Name of the key to press or a character to generate, such as `ArrowLeft` or `a`'),
});

export const pressKey: Tool = {
  schema: {
    name: 'browser_press_key',
    description: 'Press a key on the keyboard',
    inputSchema: zodToJsonSchema(pressKeySchema),
  },
  handle: async (context, params) => {
    const validatedParams = pressKeySchema.parse(params);
    return await runAndWait(context, `Pressed key ${validatedParams.key}`, async page => {
      await page.keyboard.press(validatedParams.key);
    });
  },
};

const pdfSchema = z.object({});

export const pdf: Tool = {
  schema: {
    name: 'browser_save_as_pdf',
    description: 'Save page as PDF',
    inputSchema: zodToJsonSchema(pdfSchema),
  },
  handle: async context => {
    const page = await context.existingPage();
    const fileName = path.join(os.tmpdir(), `/page-${new Date().toISOString()}.pdf`);
    await page.pdf({ path: fileName });
    return {
      content: [{
        type: 'text',
        text: `Saved as ${fileName}`,
      }],
    };
  },
};

const closeSchema = z.object({});

export const close: Tool = {
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

const saveStateSchema = z.object({});

export const saveState: Tool = {
  schema: {
    name: 'browser_save_state',
    description: 'Save cookies and local storage to reuse logged in state in the future',
    inputSchema: zodToJsonSchema(saveStateSchema),
  },
  handle: async context => {
    const { origin, filename } = await context.saveState();
    return {
      content: [{
        type: 'text',
        text: `Storage state for ${origin} saved as ${filename}`,
      }],
    };
  },
};

const clearSavedStateSchema = z.object({
  origin: z.string().optional().describe('The origin to clear the saved state for. Erases all saved states if not provided'),
});

export const clearSavedState: Tool = {
  schema: {
    name: 'browser_clear_saved_state',
    description: 'Clear cookies and local storage for a specific origin',
    inputSchema: zodToJsonSchema(clearSavedStateSchema),
  },
  handle: async (context, params) => {
    const validatedParams = clearSavedStateSchema.parse(params);
    await context.clearSavedState(validatedParams.origin);
    return {
      content: [{
        type: 'text',
        text: `Storage state cleared`,
      }],
    };
  },
};
