// @ts-nocheck
import { z } from 'zod';
import { expectationSchema } from '../schemas/expectation.js';
import { defineTabTool, defineTool } from './tool.js';

const navigate = defineTool({
  capability: 'core',
  schema: {
    name: 'browser_navigate',
    title: 'Navigate to a URL',
    description: `Navigate to a URL.expectation:{includeSnapshot:true} to see what loaded,false if you know what to do next.snapshotOptions:{selector:"#content"} to focus on main content(saves 50% tokens).diffOptions:{enabled:true} when revisiting pages to see only changes.CONSIDER batch_execute for navigate→interact workflows.`,
    inputSchema: z.object({
      url: z.string().describe('The URL to navigate to'),
      expectation: expectationSchema,
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
    description:
      'Go back to previous page.expectation:{includeSnapshot:true} to see previous page,false if continuing workflow.diffOptions:{enabled:true} shows only what changed from forward page.USE batch_execute for back→interact sequences.',
    inputSchema: z.object({
      expectation: expectationSchema,
    }),
    type: 'readOnly',
  },
  handle: async (tab, _params, response) => {
    await tab.page.goBack();
    response.addCode('await page.goBack();');
  },
});
const goForward = defineTabTool({
  capability: 'core',
  schema: {
    name: 'browser_navigate_forward',
    title: 'Go forward',
    description:
      'Go forward to next page.expectation:{includeSnapshot:true} to see next page,false if continuing workflow.diffOptions:{enabled:true} shows only what changed from previous page.USE batch_execute for forward→interact sequences.',
    inputSchema: z.object({
      expectation: expectationSchema,
    }),
    type: 'readOnly',
  },
  handle: async (tab, _params, response) => {
    await tab.page.goForward();
    response.addCode('await page.goForward();');
  },
});
export default [navigate, goBack, goForward];
