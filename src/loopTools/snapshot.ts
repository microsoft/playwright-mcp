import { z } from 'zod';
import { defineTool } from './tool.js';
export const snapshot = defineTool({
  schema: {
    name: 'browser_snapshot',
    title: 'Take a snapshot of the browser',
    description: 'Take a snapshot of the browser to read what is on the page.',
    inputSchema: z.object({}),
    type: 'readOnly',
  },
  handle: async (context, params) => {
    return await context.runTask('Capture browser snapshot', true);
  },
});
