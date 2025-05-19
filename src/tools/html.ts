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

const elementSchema = z.object({
  element: z.string().describe('Human-readable element description used to obtain permission to interact with the element'),
});

const html = defineTool({
  capability: 'core',
  schema: {
    name: 'browser_html_snapshot',
    title: 'Get HTML',
    description: 'Get the HTML content of the current page',
    inputSchema: elementSchema,
    type: 'readOnly',
  },

  handle: async (context, params) => {
    const tab = context.currentTabOrDie();
    let element = params.element ? params.element : 'body';
    const snapshot = await tab.page.$eval(element, (el: { outerHTML: string }) => el.outerHTML);
    return {
      content: [{ type: 'text', text: '```html\n' + snapshot + '\n```', mimeType: 'text/html' }],
      code: ['// Get page HTML content', `${snapshot}`],
      captureSnapshot: false,
      waitForNetwork: true
    };
  }
});

export default [html];