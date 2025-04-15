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
// 동적으로 불러오기 위해 import 제거
// import { injectOverlay } from './codegen';

const selectSchema = z.object({
  index: z.number().int().positive().describe('Index of the tab to select'),
});

const select: ToolFactory = snapshot => ({
  capability: 'tabs',
  schema: {
    name: 'browser_tab_select',
    description: 'Select a tab by index',
    inputSchema: zodToJsonSchema(selectSchema),
  },
  handle: async (context, params) => {
    const validatedParams = selectSchema.parse(params);
    await context.selectTab(validatedParams.index);

    // 탭 선택 후 자동으로 오버레이 주입
    try {
      // 순환 참조 방지를 위해 동적으로 가져오기
      const { injectOverlay } = require('./codegen');
      if (typeof injectOverlay === 'function')
        await injectOverlay(context);

    } catch (error) {
      console.error('Failed to inject recorder overlay after tab selection:', error);
    }

    return context.currentTab().runAndWaitWithSnapshot(async tab => {}, {
      status: `Selected tab ${validatedParams.index}`,
    });
  },
});

const newTabSchema = z.object({
  url: z.string().optional().describe('The URL to navigate to'),
});

const newTab: ToolFactory = snapshot => ({
  capability: 'tabs',
  schema: {
    name: 'browser_tab_new',
    description: 'Open a new tab',
    inputSchema: zodToJsonSchema(newTabSchema),
  },
  handle: async (context, params) => {
    const validatedParams = newTabSchema.parse(params);
    const tab = await context.newTab();

    const result = await tab.runAndWaitWithSnapshot(async tab => {
      if (validatedParams.url)
        await tab.navigate(validatedParams.url);

      // 새 탭에 자동으로 오버레이 주입
      try {
        // 순환 참조 방지를 위해 동적으로 가져오기
        const { injectOverlay } = require('./codegen');
        if (typeof injectOverlay === 'function')
          await injectOverlay(context);

      } catch (error) {
        console.error('Failed to inject recorder overlay in new tab:', error);
      }
    }, {
      status: `Opened new tab${validatedParams.url ? ` and navigated to ${validatedParams.url}` : ''}`,
    });

    return result;
  },
});

const listTabsSchema = z.object({});

const listTabs: ToolFactory = snapshot => ({
  capability: 'tabs',
  schema: {
    name: 'browser_tab_list',
    description: 'List browser tabs',
    inputSchema: zodToJsonSchema(listTabsSchema),
  },
  handle: async context => {
    const tabList = await context.listTabs();
    return {
      content: [{
        type: 'text',
        text: tabList,
      }],
    };
  },
});

const closeTabSchema = z.object({
  index: z.number().int().positive().optional().describe('Index of the tab to close'),
});

const closeTab: ToolFactory = snapshot => ({
  capability: 'tabs',
  schema: {
    name: 'browser_tab_close',
    description: 'Close a tab',
    inputSchema: zodToJsonSchema(closeTabSchema),
  },
  handle: async (context, params) => {
    const validatedParams = closeTabSchema.parse(params);
    const tabList = await context.closeTab(validatedParams?.index);

    // 탭 닫은 후 현재 탭에 오버레이 주입 시도
    try {
      if (context.tabs().length > 0) {
        // 순환 참조 방지를 위해 동적으로 가져오기
        const { injectOverlay } = require('./codegen');
        if (typeof injectOverlay === 'function')
          await injectOverlay(context);

      }
    } catch (error) {
      console.error('Failed to inject recorder overlay after closing tab:', error);
    }

    return {
      content: [{
        type: 'text',
        text: tabList,
      }],
    };
  },
});

export default (snapshot: boolean) => [
  select(snapshot),
  newTab(snapshot),
  listTabs(snapshot),
  closeTab(snapshot),
];
