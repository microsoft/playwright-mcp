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

import type { ToolFactory } from './tool';

const navigateSchema = z.object({
  url: z.string().describe('The URL to navigate to'),
});

const navigate: ToolFactory = captureSnapshot => ({
  capability: 'core',

  schema: {
    name: 'browser_navigate',
    description: 'Navigate to a URL',
    inputSchema: zodToJsonSchema(navigateSchema),
  },

  handle: async (context, params) => {
    const validatedParams = navigateSchema.parse(params);
    const tab = await context.ensureTab();
    await tab.navigate(validatedParams.url);

    const code = [
      `// Navigate to ${validatedParams.url}`,
      `await page.goto('${validatedParams.url}');`,
    ];

    return {
      code,
      action: async () => ({}),
      captureSnapshot,
      waitForNetwork: false,
    };
  },
});

const goBackSchema = z.object({});

const goBack: ToolFactory = captureSnapshot => ({
  capability: 'history',
  schema: {
    name: 'browser_navigate_back',
    description: 'Go back to the previous page',
    inputSchema: zodToJsonSchema(goBackSchema),
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
      action: async () => ({}),
      captureSnapshot,
      waitForNetwork: false,
    };
  },
});

const goForwardSchema = z.object({});

const goForward: ToolFactory = captureSnapshot => ({
  capability: 'history',
  schema: {
    name: 'browser_navigate_forward',
    description: 'Go forward to the next page',
    inputSchema: zodToJsonSchema(goForwardSchema),
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
      action: async () => ({}),
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
