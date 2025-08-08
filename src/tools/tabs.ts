// @ts-nocheck
import { z } from 'zod';
import { expectationSchema } from '../schemas/expectation.js';
import { defineTool } from './tool.js';

const listTabs = defineTool({
  capability: 'core-tabs',
  schema: {
    name: 'browser_tab_list',
    title: 'List tabs',
    description:
      'List browser tabs.Always returns tab list with titles and URLs.expectation:{includeSnapshot:false} for just tab info,true to also see current tab content.USE before tab_select to find right tab.',
    inputSchema: z.object({
      expectation: expectationSchema,
    }),
    type: 'readOnly',
  },
  handle: async (context, _params, response) => {
    await context.ensureTab();
    response.setIncludeTabs();
  },
});
const selectTab = defineTool({
  capability: 'core-tabs',
  schema: {
    name: 'browser_tab_select',
    title: 'Select a tab',
    description: `Select a tab by index.expectation:{includeSnapshot:true} to see selected tab content,false if you know what's there.USE batch_execute for tab_select→interact workflows.`,
    inputSchema: z.object({
      index: z.number().describe('The index of the tab to select'),
      expectation: expectationSchema,
    }),
    type: 'readOnly',
  },
  handle: async (context, params, response) => {
    await context.selectTab(params.index);
    response.setIncludeSnapshot();
  },
});
const newTab = defineTool({
  capability: 'core-tabs',
  schema: {
    name: 'browser_tab_new',
    title: 'Open a new tab',
    description: `Open a new tab.url:"https://example.com" to navigate immediately,omit for blank tab.expectation:{includeSnapshot:true} to see new tab,false if opening for later use.CONSIDER batch_execute for new_tab→navigate→interact.`,
    inputSchema: z.object({
      url: z
        .string()
        .optional()
        .describe(
          'The URL to navigate to in the new tab. If not provided, the new tab will be blank.'
        ),
      expectation: expectationSchema,
    }),
    type: 'readOnly',
  },
  handle: async (context, params, response) => {
    const tab = await context.newTab();
    if (params.url) {
      await tab.navigate(params.url);
    }
    response.setIncludeSnapshot();
  },
});
const closeTab = defineTool({
  capability: 'core-tabs',
  schema: {
    name: 'browser_tab_close',
    title: 'Close a tab',
    description:
      'Close a tab.index:N to close specific tab,omit to close current.expectation:{includeSnapshot:false} usually sufficient,true to verify remaining tabs.USE batch_execute for multi-tab cleanup.',
    inputSchema: z.object({
      index: z
        .number()
        .optional()
        .describe(
          'The index of the tab to close. Closes current tab if not provided.'
        ),
      expectation: expectationSchema,
    }),
    type: 'destructive',
  },
  handle: async (context, params, response) => {
    await context.closeTab(params.index);
    response.setIncludeSnapshot();
  },
});
export default [listTabs, newTab, selectTab, closeTab];
