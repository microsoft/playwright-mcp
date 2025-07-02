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

const listTabs = defineTool({
  capability: 'tabs',

  schema: {
    name: 'browser_tab_list',
    title: 'List tabs',
    description: 'List browser tabs',
    inputSchema: z.object({}),
    type: 'readOnly',
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
});

const selectTab: ToolFactory = captureSnapshot => defineTool({
  capability: 'tabs',

  schema: {
    name: 'browser_tab_select',
    title: 'Select a tab',
    description: 'Select a tab by index',
    inputSchema: z.object({
      index: z.number().describe('The index of the tab to select'),
    }),
    type: 'readOnly',
  },

  handle: async (context, params) => {
    await context.selectTab(params.index);
    const code = [
      `// <internal code to select tab ${params.index}>`,
    ];

    return {
      code,
      captureSnapshot,
      waitForNetwork: false
    };
  },
});

const newTab: ToolFactory = captureSnapshot => defineTool({
  capability: 'tabs',

  schema: {
    name: 'browser_tab_new',
    title: 'Open a new tab',
    description: 'Open a new tab',
    inputSchema: z.object({
      url: z.string().optional().describe('The URL to navigate to in the new tab. If not provided, the new tab will be blank.'),
    }),
    type: 'readOnly',
  },

  handle: async (context, params) => {
    await context.newTab();
    if (params.url)
      await context.currentTabOrDie().navigate(params.url);

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

const closeTab: ToolFactory = captureSnapshot => defineTool({
  capability: 'tabs',

  schema: {
    name: 'browser_tab_close',
    title: 'Close a tab',
    description: 'Close a tab',
    inputSchema: z.object({
      index: z.number().optional().describe('The index of the tab to close. Closes current tab if not provided.'),
    }),
    type: 'destructive',
  },

  handle: async (context, params) => {
    await context.closeTab(params.index);
    const code = [
      `// <internal code to close tab ${params.index}>`,
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
