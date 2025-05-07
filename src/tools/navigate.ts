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

const navigate: ToolFactory = captureSnapshot => defineTool({
  capability: 'core',

  schema: {
    name: 'browser_navigate',
    title: 'Navigate to a URL',
    description: 'Navigate to a URL',
    inputSchema: z.object({
      url: z.string().describe('The URL to navigate to'),
    }),
    type: 'destructive',
  },

  handle: async (context, params) => {
    const tab = await context.ensureTab();
    await tab.navigate(params.url);

    const code = [
      `// Navigate to ${params.url}`,
      `await page.goto('${params.url}');`,
    ];

    return {
      code,
      captureSnapshot,
      waitForNetwork: false,
    };
  },
});

const goBack: ToolFactory = captureSnapshot => defineTool({
  capability: 'history',
  schema: {
    name: 'browser_navigate_back',
    title: 'Go back',
    description: 'Go back to the previous page',
    inputSchema: z.object({}),
    type: 'readOnly',
  },

  handle: async context => {
    const tab = await context.ensureTab();
    await tab.page.goBack();
    const code = [
      `// Navigate back`,
      `await page.goBack();`,
    ];

    return {
      code,
      captureSnapshot,
      waitForNetwork: false,
    };
  },
});

const goForward: ToolFactory = captureSnapshot => defineTool({
  capability: 'history',
  schema: {
    name: 'browser_navigate_forward',
    title: 'Go forward',
    description: 'Go forward to the next page',
    inputSchema: z.object({}),
    type: 'readOnly',
  },
  handle: async context => {
    const tab = context.currentTabOrDie();
    await tab.page.goForward();
    const code = [
      `// Navigate forward`,
      `await page.goForward();`,
    ];
    return {
      code,
      captureSnapshot,
      waitForNetwork: false,
    };
  },
});

export default (captureSnapshot: boolean) => [
  navigate(captureSnapshot),
  goBack(captureSnapshot),
  goForward(captureSnapshot),
];
