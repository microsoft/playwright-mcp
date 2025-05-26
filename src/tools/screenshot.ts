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
import { generateLocator } from './utils.js';

import type * as playwright from 'playwright';

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

    const locator = params.ref ? snapshot.refLocator({ element: params.element || '', ref: params.ref }) : null;

    if (locator)
      code.push(`await page.${await generateLocator(locator)}.screenshot(${javascript.formatObject(options)});`);
    else
      code.push(`await page.screenshot(${javascript.formatObject(options)});`);

    const includeBase64 = context.clientSupportsImages();
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

export default [
  screenshot,
];
