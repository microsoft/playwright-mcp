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

import type * as playwright from 'playwright';
import type { Tool } from './tool';
import path from 'path';
import os from 'os';
import { sanitizeForFilePath } from './utils';
import { generateLocator } from '../context';
import * as javascript from '../javascript';

const snapshot: Tool = {
  capability: 'core',
  schema: {
    name: 'browser_snapshot',
    description: 'Capture accessibility snapshot of the current page, this is better than screenshot',
    inputSchema: zodToJsonSchema(z.object({})),
  },

  handle: async context => {
    const tab = await context.ensureTab();
    return await tab.run(async () => {
      const code = [`// <internal code to capture accessibility snapshot>`];
      return { code };
    }, { captureSnapshot: true });
  },
};

const elementSchema = z.object({
  element: z.string().describe('Human-readable element description used to obtain permission to interact with the element'),
  ref: z.string().describe('Exact target element reference from the page snapshot'),
});

const click: Tool = {
  capability: 'core',
  schema: {
    name: 'browser_click',
    description: 'Perform click on a web page',
    inputSchema: zodToJsonSchema(elementSchema),
  },

  handle: async (context, params) => {
    const validatedParams = elementSchema.parse(params);
    return await context.currentTab().runAndWaitWithSnapshot(async snapshot => {
      const locator = snapshot.refLocator(validatedParams.ref);
      const code = [
        `// Click ${validatedParams.element}`,
        `await page.${await generateLocator(locator)}.click();`
      ];
      await locator.click();
      return { code };
    });
  },
};

const dragSchema = z.object({
  startElement: z.string().describe('Human-readable source element description used to obtain the permission to interact with the element'),
  startRef: z.string().describe('Exact source element reference from the page snapshot'),
  endElement: z.string().describe('Human-readable target element description used to obtain the permission to interact with the element'),
  endRef: z.string().describe('Exact target element reference from the page snapshot'),
});

const drag: Tool = {
  capability: 'core',
  schema: {
    name: 'browser_drag',
    description: 'Perform drag and drop between two elements',
    inputSchema: zodToJsonSchema(dragSchema),
  },

  handle: async (context, params) => {
    const validatedParams = dragSchema.parse(params);
    return await context.currentTab().runAndWaitWithSnapshot(async snapshot => {
      const startLocator = snapshot.refLocator(validatedParams.startRef);
      const endLocator = snapshot.refLocator(validatedParams.endRef);
      const code = [
        `// Drag ${validatedParams.startElement} to ${validatedParams.endElement}`,
        `await page.${await generateLocator(startLocator)}.dragTo(page.${await generateLocator(endLocator)});`
      ];
      await startLocator.dragTo(endLocator);
      return { code };
    });
  },
};

const hover: Tool = {
  capability: 'core',
  schema: {
    name: 'browser_hover',
    description: 'Hover over element on page',
    inputSchema: zodToJsonSchema(elementSchema),
  },

  handle: async (context, params) => {
    const validatedParams = elementSchema.parse(params);
    return await context.currentTab().runAndWaitWithSnapshot(async snapshot => {
      const locator = snapshot.refLocator(validatedParams.ref);
      const code = [
        `// Hover over ${validatedParams.element}`,
        `await page.${await generateLocator(locator)}.hover();`
      ];
      await locator.hover();
      return { code };
    });
  },
};

const typeSchema = elementSchema.extend({
  text: z.string().describe('Text to type into the element'),
  submit: z.boolean().optional().describe('Whether to submit entered text (press Enter after)'),
  slowly: z.boolean().optional().describe('Whether to type one character at a time. Useful for triggering key handlers in the page. By default entire text is filled in at once.'),
});

const type: Tool = {
  capability: 'core',
  schema: {
    name: 'browser_type',
    description: 'Type text into editable element',
    inputSchema: zodToJsonSchema(typeSchema),
  },

  handle: async (context, params) => {
    const validatedParams = typeSchema.parse(params);
    return await context.currentTab().runAndWaitWithSnapshot(async snapshot => {
      const locator = snapshot.refLocator(validatedParams.ref);

      const code: string[] = [];
      if (validatedParams.slowly) {
        code.push(`// Press "${validatedParams.text}" sequentially into "${validatedParams.element}"`);
        code.push(`await page.${await generateLocator(locator)}.pressSequentially(${javascript.quote(validatedParams.text)});`);
        await locator.pressSequentially(validatedParams.text);
      } else {
        code.push(`// Fill "${validatedParams.text}" into "${validatedParams.element}"`);
        code.push(`await page.${await generateLocator(locator)}.fill(${javascript.quote(validatedParams.text)});`);
        await locator.fill(validatedParams.text);
      }
      if (validatedParams.submit) {
        code.push(`// Submit text`);
        code.push(`await page.${await generateLocator(locator)}.press('Enter');`);
        await locator.press('Enter');
      }
      return { code };
    });
  },
};

const selectOptionSchema = elementSchema.extend({
  values: z.array(z.string()).describe('Array of values to select in the dropdown. This can be a single value or multiple values.'),
});

const selectOption: Tool = {
  capability: 'core',
  schema: {
    name: 'browser_select_option',
    description: 'Select an option in a dropdown',
    inputSchema: zodToJsonSchema(selectOptionSchema),
  },

  handle: async (context, params) => {
    const validatedParams = selectOptionSchema.parse(params);
    return await context.currentTab().runAndWaitWithSnapshot(async snapshot => {
      const locator = snapshot.refLocator(validatedParams.ref);
      const code = [
        `// Select options [${validatedParams.values.join(', ')}] in ${validatedParams.element}`,
        `await page.${await generateLocator(locator)}.selectOption(${javascript.formatObject(validatedParams.values)});`
      ];
      await locator.selectOption(validatedParams.values);
      return { code };
    });
  },
};

const screenshotSchema = z.object({
  raw: z.boolean().optional().describe('Whether to return without compression (in PNG format). Default is false, which returns a JPEG image.'),
  element: z.string().optional().describe('Human-readable element description used to obtain permission to interact with the element. If not provided, the screenshot will be taken of viewport. If element is provided, ref must be provided too.'),
  ref: z.string().optional().describe('Exact target element reference from the page snapshot. If not provided, the screenshot will be taken of viewport. If ref is provided, element must be provided too.'),
}).refine(data => {
  return (!data.element) === (!data.ref);
}, {
  message: 'Both element and ref must be provided or neither.',
  path: ['ref', 'element']
});

const screenshot: Tool = {
  capability: 'core',
  schema: {
    name: 'browser_take_screenshot',
    description: `Take a screenshot of the current page. You can't perform actions based on the screenshot, use browser_snapshot for actions.`,
    inputSchema: zodToJsonSchema(screenshotSchema),
  },

  handle: async (context, params) => {
    const validatedParams = screenshotSchema.parse(params);
    const tab = context.currentTab();
    const fileType = validatedParams.raw ? 'png' : 'jpeg';
    const fileName = path.join(os.tmpdir(), sanitizeForFilePath(`page-${new Date().toISOString()}`)) + `.${fileType}`;
    const options: playwright.PageScreenshotOptions = { type: fileType, quality: fileType === 'png' ? undefined : 50, scale: 'css', path: fileName };
    const isElementScreenshot = validatedParams.element && validatedParams.ref;
    return await context.currentTab().runAndWaitWithSnapshot(async snapshot => {
      let screenshot: Buffer | undefined;
      const code = [
        `// Screenshot ${isElementScreenshot ? validatedParams.element : 'viewport'}`,
      ];
      if (isElementScreenshot) {
        const locator = snapshot.refLocator(validatedParams.ref!);
        code.push(`await page.${await generateLocator(locator)}.screenshot(${javascript.formatObject(options)});`);
        screenshot = await locator.screenshot(options);
      } else {
        code.push(`await page.screenshot(${javascript.formatObject(options)});`);
        screenshot = await tab.page.screenshot(options);
      }
      code.push(`// Screenshot saved as ${fileName}`);
      return {
        code,
        images: [{
          data: screenshot.toString('base64'),
          mimeType: fileType === 'png' ? 'image/png' : 'image/jpeg',
        }]
      };
    }, { captureSnapshot: false });
  }
};


export default [
  snapshot,
  click,
  drag,
  hover,
  type,
  selectOption,
  screenshot,
];
