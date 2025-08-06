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
import { defineTool, defineTabTool } from './tool.js';
import { expectationSchema } from '../schemas/expectation.js';

const navigate = defineTool({
  capability: 'core',

  schema: {
    name: 'browser_navigate',
    title: 'Navigate to a URL',
    description: `Navigate to URL.Default:minimal(false).Use expectation:{includeSnapshot:true,includeConsole:true,includeDownloads:true,includeTabs:true,includeCode:true,snapshotOptions:{selector:"#content",format:"aria"},consoleOptions:{levels:["error","warn"],maxMessages:10},diffOptions:{enabled:true,format:"unified",threshold:0.1,maxDiffLines:50},imageOptions:{quality:80,maxWidth:1200,maxHeight:800,format:"jpeg"}}.TIP:Use selector to focus on content area.Set includeSnapshot:false unless needed.`,
    inputSchema: z.object({
      url: z.string().describe('The URL to navigate to'),
      expectation: expectationSchema
    }),
    type: 'destructive',
  },

  handle: async (context, params, response) => {
    const tab = await context.ensureTab();
    await tab.navigate(params.url);

    response.addCode(`await page.goto('${params.url}');`);
  },
});

const goBack = defineTabTool({
  capability: 'core',
  schema: {
    name: 'browser_navigate_back',
    title: 'Go back',
    description: `Go back.Default:minimal(false).Use expectation:{includeSnapshot:true,snapshotOptions:{selector:"main",format:"aria"},consoleOptions:{levels:["error","warn"]},diffOptions:{enabled:true}}.TIP:includeSnapshot:false for simple nav.`,
    inputSchema: z.object({
      expectation: expectationSchema
    }),
    type: 'readOnly',
  },

  handle: async (tab, params, response) => {
    await tab.page.goBack();
    response.addCode(`await page.goBack();`);
  },
});

const goForward = defineTabTool({
  capability: 'core',
  schema: {
    name: 'browser_navigate_forward',
    title: 'Go forward',
    description: `Go forward.Default:minimal(false).Use expectation:{includeSnapshot:true,snapshotOptions:{selector:"main",format:"aria"},consoleOptions:{levels:["error","warn"]},diffOptions:{enabled:true}}.TIP:includeSnapshot:false for simple nav.`,
    inputSchema: z.object({
      expectation: expectationSchema
    }),
    type: 'readOnly',
  },
  handle: async (tab, params, response) => {
    await tab.page.goForward();
    response.addCode(`await page.goForward();`);
  },
});

export default [
  navigate,
  goBack,
  goForward,
];
