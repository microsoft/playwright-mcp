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

import type { ToolFactory, Tool } from './tool';

const listTabs: Tool = {
  capability: 'tabs',

  schema: {
    name: 'browser_tab_list',
    description: 'List browser tabs',
    inputSchema: zodToJsonSchema(z.object({})),
  },

  handle: async context => {
    await context.ensureTab();
    return {
      code: [`// <internal code to list tabs>`],
      captureSnapshot: false,
      waitForNetwork: false,
      resultOverride: {
        content: [{
          type: 'text',
          text: await context.listTabsMarkdown(),
        }],
      },
    };
  },
};

const selectTabSchema = z.object({
  index: z.number().describe('The index of the tab to select'),
});

const selectTab: ToolFactory = captureSnapshot => ({
  capability: 'tabs',

  schema: {
    name: 'browser_tab_select',
    description: 'Select a tab by index',
    inputSchema: zodToJsonSchema(selectTabSchema),
  },

  handle: async (context, params) => {
    const validatedParams = selectTabSchema.parse(params);
    await context.selectTab(validatedParams.index);
    const code = [
      `// <internal code to select tab ${validatedParams.index}>`,
    ];

    return {
      code,
      captureSnapshot,
      waitForNetwork: false
    };
  },
});

const newTabSchema = z.object({
  url: z.string().optional().describe('The URL to navigate to in the new tab. If not provided, the new tab will be blank.'),
});

const newTab: ToolFactory = captureSnapshot => ({
  capability: 'tabs',

  schema: {
    name: 'browser_tab_new',
    description: 'Open a new tab',
    inputSchema: zodToJsonSchema(newTabSchema),
  },

  handle: async (context, params) => {
    const validatedParams = newTabSchema.parse(params);
    await context.newTab();
    if (validatedParams.url)
      await context.currentTabOrDie().navigate(validatedParams.url);

    const code = [
      `// <internal code to open a new tab>`,
    ];
    return {
      code,
      captureSnapshot,
      waitForNetwork: false
    };
  },
});

const closeTabSchema = z.object({
  index: z.number().optional().describe('The index of the tab to close. Closes current tab if not provided.'),
});

const closeTab: ToolFactory = captureSnapshot => ({
  capability: 'tabs',

  schema: {
    name: 'browser_tab_close',
    description: 'Close a tab',
    inputSchema: zodToJsonSchema(closeTabSchema),
  },

  handle: async (context, params) => {
    const validatedParams = closeTabSchema.parse(params);
    await context.closeTab(validatedParams.index);
    const code = [
      `// <internal code to close tab ${validatedParams.index}>`,
    ];
    return {
      code,
      captureSnapshot,
      waitForNetwork: false
    };
  },
});

export default (captureSnapshot: boolean) => [
  listTabs,
  newTab(captureSnapshot),
  selectTab(captureSnapshot),
  closeTab(captureSnapshot),
];
