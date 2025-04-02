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

import { sanitizeForFilePath } from './utils';

import type { ToolFactory, Tool } from './tool';

const navigateSchema = z.object({
  url: z.string().describe('The URL to navigate to'),
});

export const navigate: ToolFactory = captureSnapshot => ({
  schema: {
    name: 'browser_navigate',
    description: 'Navigate to a URL',
    inputSchema: zodToJsonSchema(navigateSchema),
  },
  handle: async (context, params) => {
    const validatedParams = navigateSchema.parse(params);
    await context.createPage();
    return await context.run(async page => {
      await page.goto(validatedParams.url, { waitUntil: 'domcontentloaded' });
      // Cap load event to 5 seconds, the page is operational at this point.
      await page.waitForLoadState('load', { timeout: 5000 }).catch(() => {});
    }, {
      status: `Navigated to ${validatedParams.url}`,
      captureSnapshot,
    });
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
    return await context.runAndWait(async page => {
      await page.goBack();
    }, {
      status: 'Navigated back',
      captureSnapshot: snapshot,
    });
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
    return await context.runAndWait(async page => {
      await page.goForward();
    }, {
      status: 'Navigated forward',
      captureSnapshot: snapshot,
    });
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
    await new Promise(f => setTimeout(f, Math.min(10000, validatedParams.time * 1000)));
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

export const pressKey: (captureSnapshot: boolean) => Tool = captureSnapshot => ({
  schema: {
    name: 'browser_press_key',
    description: 'Press a key on the keyboard',
    inputSchema: zodToJsonSchema(pressKeySchema),
  },
  handle: async (context, params) => {
    const validatedParams = pressKeySchema.parse(params);
    return await context.runAndWait(async page => {
      await page.keyboard.press(validatedParams.key);
    }, {
      status: `Pressed key ${validatedParams.key}`,
      captureSnapshot,
    });
  },
});

const pdfSchema = z.object({});

export const pdf: Tool = {
  schema: {
    name: 'browser_save_as_pdf',
    description: 'Save page as PDF',
    inputSchema: zodToJsonSchema(pdfSchema),
  },
  handle: async context => {
    const page = context.existingPage();
    const fileName = path.join(os.tmpdir(), sanitizeForFilePath(`page-${new Date().toISOString()}`)) + '.pdf';
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

const chooseFileSchema = z.object({
  paths: z.array(z.string()).describe('The absolute paths to the files to upload. Can be a single file or multiple files.'),
});

export const chooseFile: ToolFactory = captureSnapshot => ({
  schema: {
    name: 'browser_choose_file',
    description: 'Choose one or multiple files to upload',
    inputSchema: zodToJsonSchema(chooseFileSchema),
  },
  handle: async (context, params) => {
    const validatedParams = chooseFileSchema.parse(params);
    return await context.runAndWait(async () => {
      await context.submitFileChooser(validatedParams.paths);
    }, {
      status: `Chose files ${validatedParams.paths.join(', ')}`,
      captureSnapshot,
      noClearFileChooser: true,
    });
  },
});

export const install: Tool = {
  schema: {
    name: 'browser_install',
    description: 'Install the browser specified in the config. Call this if you get an error about the browser not being installed.',
    inputSchema: zodToJsonSchema(z.object({})),
  },
  handle: async context => {
    const channel = await context.install();
    return {
      content: [{
        type: 'text',
        text: `Browser ${channel} installed`,
      }],
    };
  },
};
