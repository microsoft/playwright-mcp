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
  schema: {
    name: 'browser_tab_list',
    description: 'List browser tabs',
    inputSchema: zodToJsonSchema(z.object({})),
  },
  handle: async context => {
    return {
      content: [{
        type: 'text',
        text: await context.listTabs(),
      }],
    };
  },
};

const selectTabSchema = z.object({
  index: z.number().describe('The index of the tab to select'),
});

const selectTab: ToolFactory = captureSnapshot => ({
  schema: {
    name: 'browser_tab_select',
    description: 'Select a tab by index',
    inputSchema: zodToJsonSchema(selectTabSchema),
  },
  handle: async (context, params) => {
    const validatedParams = selectTabSchema.parse(params);
    await context.selectTab(validatedParams.index);
    const currentTab = await context.ensureTab();
    return await currentTab.run(async () => {}, { captureSnapshot });
  },
});

const newTabSchema = z.object({
  url: z.string().optional().describe('The URL to navigate to in the new tab. If not provided, the new tab will be blank.'),
});

const newTab: Tool = {
  schema: {
    name: 'browser_tab_new',
    description: 'Open a new tab',
    inputSchema: zodToJsonSchema(newTabSchema),
  },
  handle: async (context, params) => {
    const validatedParams = newTabSchema.parse(params);
    await context.newTab();
    if (validatedParams.url)
      await context.currentTab().navigate(validatedParams.url);
    return await context.currentTab().run(async () => {}, { captureSnapshot: true });
  },
};

const closeTabSchema = z.object({
  index: z.number().optional().describe('The index of the tab to close. Closes current tab if not provided.'),
});

const closeTab: ToolFactory = captureSnapshot => ({
  schema: {
    name: 'browser_tab_close',
    description: 'Close a tab',
    inputSchema: zodToJsonSchema(closeTabSchema),
  },
  handle: async (context, params) => {
    const validatedParams = closeTabSchema.parse(params);
    await context.closeTab(validatedParams.index);
    const currentTab = await context.currentTab();
    if (currentTab)
      return await currentTab.run(async () => {}, { captureSnapshot });
    return {
      content: [{
        type: 'text',
        text: await context.listTabs(),
      }],
    };
  },
});

export default (captureSnapshot: boolean) => [
  listTabs,
  newTab,
  selectTab(captureSnapshot),
  closeTab(captureSnapshot),
];
