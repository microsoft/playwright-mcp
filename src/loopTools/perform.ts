import { z } from 'zod';
import { defineTool } from './tool.js';
const performSchema = z.object({
  task: z.string().describe('The task to perform with the browser'),
});
export const perform = defineTool({
  schema: {
    name: 'browser_perform',
    title: 'Perform a task with the browser',
    description: 'Perform a task with the browser. It can click, type, export, capture screenshot, drag, hover, select options, etc.',
    inputSchema: performSchema,
    type: 'destructive',
  },
  handle: async (context, params) => {
    return await context.runTask(params.task);
  },
});
