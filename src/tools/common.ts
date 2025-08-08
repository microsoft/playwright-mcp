import { z } from 'zod';
import { defineTabTool, defineTool } from './tool.js';
import { expectationSchema } from '../schemas/expectation.js';
const close = defineTool({
  capability: 'core',
  schema: {
    name: 'browser_close',
    title: 'Close browser',
    description: 'Close the page',
    inputSchema: z.object({}),
    type: 'readOnly',
  },
  handle: async (context, params, response) => {
    await context.closeBrowserContext();
    response.setIncludeTabs();
    response.addCode(`await page.close()`);
  },
});
const resize = defineTabTool({
  capability: 'core',
  schema: {
    name: 'browser_resize',
    title: 'Resize browser window',
    description: 'Resize the browser window',
    inputSchema: z.object({
      width: z.number().describe('Width of the browser window'),
      height: z.number().describe('Height of the browser window'),
      expectation: expectationSchema
    }),
    type: 'readOnly',
  },
  handle: async (tab, params, response) => {
    response.addCode(`await page.setViewportSize({ width: ${params.width}, height: ${params.height} });`);
    await tab.waitForCompletion(async () => {
      await tab.page.setViewportSize({ width: params.width, height: params.height });
    });
  },
});
export default [
  close,
  resize
];
