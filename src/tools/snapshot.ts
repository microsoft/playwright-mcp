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

import { defineTool } from './tool.js';
import * as javascript from '../javascript.js';
import { outputFile } from '../config.js';

import type * as playwright from 'playwright';

const snapshot = defineTool({
  capability: 'core',
  schema: {
    name: 'browser_snapshot',
    title: 'Page snapshot',
    description: 'Capture accessibility snapshot of the current page, this is better than screenshot',
    inputSchema: z.object({}),
    type: 'readOnly',
  },

  handle: async context => {
    await context.ensureTab();

    return {
      code: [`// <internal code to capture accessibility snapshot>`],
      captureSnapshot: true,
      waitForNetwork: false,
    };
  },
});

const elementSchema = z.object({
  element: z.string().describe('Human-readable element description used to obtain permission to interact with the element'),
  ref: z.string().describe('Exact target element reference from the page snapshot'),
});

const click = defineTool({
  capability: 'core',
  schema: {
    name: 'browser_click',
    title: 'Click',
    description: 'Perform click on a web page',
    inputSchema: elementSchema,
    type: 'destructive',
  },

  handle: async (context, params) => {
    const tab = context.currentTabOrDie();
    const locator = tab.snapshotOrDie().refLocator(params.ref);

    const code = [
      `// Click ${params.element}`,
      `await page.${await generateLocator(locator)}.click();`
    ];

    return {
      code,
      action: () => locator.click(),
      captureSnapshot: true,
      waitForNetwork: true,
    };
  },
});

const drag = defineTool({
  capability: 'core',
  schema: {
    name: 'browser_drag',
    title: 'Drag mouse',
    description: 'Perform drag and drop between two elements',
    inputSchema: z.object({
      startElement: z.string().describe('Human-readable source element description used to obtain the permission to interact with the element'),
      startRef: z.string().describe('Exact source element reference from the page snapshot'),
      endElement: z.string().describe('Human-readable target element description used to obtain the permission to interact with the element'),
      endRef: z.string().describe('Exact target element reference from the page snapshot'),
    }),
    type: 'destructive',
  },

  handle: async (context, params) => {
    const snapshot = context.currentTabOrDie().snapshotOrDie();
    const startLocator = snapshot.refLocator(params.startRef);
    const endLocator = snapshot.refLocator(params.endRef);

    const code = [
      `// Drag ${params.startElement} to ${params.endElement}`,
      `await page.${await generateLocator(startLocator)}.dragTo(page.${await generateLocator(endLocator)});`
    ];

    return {
      code,
      action: () => startLocator.dragTo(endLocator),
      captureSnapshot: true,
      waitForNetwork: true,
    };
  },
});

const hover = defineTool({
  capability: 'core',
  schema: {
    name: 'browser_hover',
    title: 'Hover mouse',
    description: 'Hover over element on page',
    inputSchema: elementSchema,
    type: 'readOnly',
  },

  handle: async (context, params) => {
    const snapshot = context.currentTabOrDie().snapshotOrDie();
    const locator = snapshot.refLocator(params.ref);

    const code = [
      `// Hover over ${params.element}`,
      `await page.${await generateLocator(locator)}.hover();`
    ];

    return {
      code,
      action: () => locator.hover(),
      captureSnapshot: true,
      waitForNetwork: true,
    };
  },
});

const typeSchema = elementSchema.extend({
  text: z.string().describe('Text to type into the element'),
  submit: z.boolean().optional().describe('Whether to submit entered text (press Enter after)'),
  slowly: z.boolean().optional().describe('Whether to type one character at a time. Useful for triggering key handlers in the page. By default entire text is filled in at once.'),
});

const type = defineTool({
  capability: 'core',
  schema: {
    name: 'browser_type',
    title: 'Type text',
    description: 'Type text into editable element',
    inputSchema: typeSchema,
    type: 'destructive',
  },

  handle: async (context, params) => {
    const snapshot = context.currentTabOrDie().snapshotOrDie();
    const locator = snapshot.refLocator(params.ref);

    const code: string[] = [];
    const steps: (() => Promise<void>)[] = [];

    if (params.slowly) {
      code.push(`// Press "${params.text}" sequentially into "${params.element}"`);
      code.push(`await page.${await generateLocator(locator)}.pressSequentially(${javascript.quote(params.text)});`);
      steps.push(() => locator.pressSequentially(params.text));
    } else {
      code.push(`// Fill "${params.text}" into "${params.element}"`);
      code.push(`await page.${await generateLocator(locator)}.fill(${javascript.quote(params.text)});`);
      steps.push(() => locator.fill(params.text));
    }

    if (params.submit) {
      code.push(`// Submit text`);
      code.push(`await page.${await generateLocator(locator)}.press('Enter');`);
      steps.push(() => locator.press('Enter'));
    }

    return {
      code,
      action: () => steps.reduce((acc, step) => acc.then(step), Promise.resolve()),
      captureSnapshot: true,
      waitForNetwork: true,
    };
  },
});

const selectOptionSchema = elementSchema.extend({
  values: z.array(z.string()).describe('Array of values to select in the dropdown. This can be a single value or multiple values.'),
});

const selectOption = defineTool({
  capability: 'core',
  schema: {
    name: 'browser_select_option',
    title: 'Select option',
    description: 'Select an option in a dropdown',
    inputSchema: selectOptionSchema,
    type: 'destructive',
  },

  handle: async (context, params) => {
    const snapshot = context.currentTabOrDie().snapshotOrDie();
    const locator = snapshot.refLocator(params.ref);

    const code = [
      `// Select options [${params.values.join(', ')}] in ${params.element}`,
      `await page.${await generateLocator(locator)}.selectOption(${javascript.formatObject(params.values)});`
    ];

    return {
      code,
      action: () => locator.selectOption(params.values).then(() => {}),
      captureSnapshot: true,
      waitForNetwork: true,
    };
  },
});

const screenshotSchema = z.object({
  raw: z.boolean().optional().describe('Whether to return without compression (in PNG format). Default is false, which returns a JPEG image.'),
  filename: z.string().optional().describe('File name to save the screenshot to. Defaults to `page-{timestamp}.{png|jpeg}` if not specified.'),
  element: z.string().optional().describe('Human-readable element description used to obtain permission to screenshot the element. If not provided, the screenshot will be taken of viewport. If element is provided, ref must be provided too.'),
  ref: z.string().optional().describe('Exact target element reference from the page snapshot. If not provided, the screenshot will be taken of viewport. If ref is provided, element must be provided too.'),
}).refine(data => {
  return !!data.element === !!data.ref;
}, {
  message: 'Both element and ref must be provided or neither.',
  path: ['ref', 'element']
});

const screenshot = defineTool({
  capability: 'core',
  schema: {
    name: 'browser_take_screenshot',
    title: 'Take a screenshot',
    description: `Take a screenshot of the current page. You can't perform actions based on the screenshot, use browser_snapshot for actions.`,
    inputSchema: screenshotSchema,
    type: 'readOnly',
  },

  handle: async (context, params) => {
    const tab = context.currentTabOrDie();
    const snapshot = tab.snapshotOrDie();
    const fileType = params.raw ? 'png' : 'jpeg';
    const fileName = await outputFile(context.config, params.filename ?? `page-${new Date().toISOString()}.${fileType}`);
    const options: playwright.PageScreenshotOptions = { type: fileType, quality: fileType === 'png' ? undefined : 50, scale: 'css', path: fileName };
    const isElementScreenshot = params.element && params.ref;

    const code = [
      `// Screenshot ${isElementScreenshot ? params.element : 'viewport'} and save it as ${fileName}`,
    ];

    const locator = params.ref ? snapshot.refLocator(params.ref) : null;

    if (locator)
      code.push(`await page.${await generateLocator(locator)}.screenshot(${javascript.formatObject(options)});`);
    else
      code.push(`await page.screenshot(${javascript.formatObject(options)});`);

    const includeBase64 = !context.config.noImageResponses;
    const action = async () => {
      const screenshot = locator ? await locator.screenshot(options) : await tab.page.screenshot(options);
      return {
        content: includeBase64 ? [{
          type: 'image' as 'image',
          data: screenshot.toString('base64'),
          mimeType: fileType === 'png' ? 'image/png' : 'image/jpeg',
        }] : []
      };
    };

    return {
      code,
      action,
      captureSnapshot: true,
      waitForNetwork: false,
    };
  }
});

export async function generateLocator(locator: playwright.Locator): Promise<string> {
  return (locator as any)._generateLocatorString();
}

export default [
  snapshot,
  click,
  drag,
  hover,
  type,
  selectOption,
  screenshot,
];
