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
// 동적으로 불러오기 위해 여기서는 import 제거
// import { injectOverlay } from './codegen';

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
    const currentTab = await context.ensureTab();

    const result = await currentTab.run(async tab => {
      await tab.navigate(validatedParams.url);

      // 페이지 로드 후 자동으로 오버레이 주입
      try {
        // 순환 참조 방지를 위해 동적으로 가져오기
        const { injectOverlay } = require('./codegen');
        if (typeof injectOverlay === 'function')
          await injectOverlay(context);

      } catch (error) {
        console.error('Failed to inject recorder overlay after navigation:', error);
      }
    }, {
      status: `Navigated to ${validatedParams.url}`,
      captureSnapshot,
    });

    return result;
  },
});

const goBackSchema = z.object({});

const goBack: ToolFactory = snapshot => ({
  capability: 'history',
  schema: {
    name: 'browser_navigate_back',
    description: 'Go back to the previous page',
    inputSchema: zodToJsonSchema(goBackSchema),
  },
  handle: async context => {
    const result = await context.currentTab().runAndWait(async tab => {
      await tab.page.goBack();

      // 이전 페이지로 이동 후 자동으로 오버레이 주입
      try {
        // 순환 참조 방지를 위해 동적으로 가져오기
        const { injectOverlay } = require('./codegen');
        if (typeof injectOverlay === 'function')
          await injectOverlay(context);

      } catch (error) {
        console.error('Failed to inject recorder overlay after going back:', error);
      }
    }, {
      status: 'Navigated back',
      captureSnapshot: snapshot,
    });

    return result;
  },
});

const goForwardSchema = z.object({});

const goForward: ToolFactory = snapshot => ({
  capability: 'history',
  schema: {
    name: 'browser_navigate_forward',
    description: 'Go forward to the next page',
    inputSchema: zodToJsonSchema(goForwardSchema),
  },
  handle: async context => {
    const result = await context.currentTab().runAndWait(async tab => {
      await tab.page.goForward();

      // 다음 페이지로 이동 후 자동으로 오버레이 주입
      try {
        // 순환 참조 방지를 위해 동적으로 가져오기
        const { injectOverlay } = require('./codegen');
        if (typeof injectOverlay === 'function')
          await injectOverlay(context);

      } catch (error) {
        console.error('Failed to inject recorder overlay after going forward:', error);
      }
    }, {
      status: 'Navigated forward',
      captureSnapshot: snapshot,
    });

    return result;
  },
});

export default (captureSnapshot: boolean) => [
  navigate(captureSnapshot),
  goBack(captureSnapshot),
  goForward(captureSnapshot),
];
