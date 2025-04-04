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
  schema: {
    name: 'browser_navigate',
    description: 'Navigate to a URL',
    inputSchema: zodToJsonSchema(navigateSchema),
  },
  handle: async (context, params) => {
    const validatedParams = navigateSchema.parse(params);
    const currentTab = await context.ensureTab();
    return await currentTab.run(async tab => {
      await tab.navigate(validatedParams.url);
    }, {
      status: `Navigated to ${validatedParams.url}`,
      captureSnapshot,
    });
  },
});

const goBackSchema = z.object({});

const goBack: ToolFactory = snapshot => ({
  schema: {
    name: 'browser_navigate_back',
    description: 'Go back to the previous page',
    inputSchema: zodToJsonSchema(goBackSchema),
  },
  handle: async context => {
    return await context.currentTab().runAndWait(async tab => {
      await tab.page.goBack();
    }, {
      status: 'Navigated back',
      captureSnapshot: snapshot,
    });
  },
});

const goForwardSchema = z.object({});

const goForward: ToolFactory = snapshot => ({
  schema: {
    name: 'browser_navigate_forward',
    description: 'Go forward to the next page',
    inputSchema: zodToJsonSchema(goForwardSchema),
  },
  handle: async context => {
    return await context.currentTab().runAndWait(async tab => {
      await tab.page.goForward();
    }, {
      status: 'Navigated forward',
      captureSnapshot: snapshot,
    });
  },
});

export default (captureSnapshot: boolean) => [
  navigate(captureSnapshot),
  goBack(captureSnapshot),
  goForward(captureSnapshot),
];
