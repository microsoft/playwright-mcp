import { z } from 'zod';
import { filterConsoleMessages } from '../utils/console-filter.js';
import { defineTabTool } from './tool.js';

const consoleOptionsSchema = z
  .object({
    levels: z.array(z.enum(['log', 'warn', 'error', 'info'])).optional(),
    maxMessages: z.number().optional().default(10),
    patterns: z
      .array(z.string())
      .optional()
      .describe('Regex patterns to filter messages'),
    removeDuplicates: z
      .boolean()
      .optional()
      .default(false)
      .describe('Remove duplicate messages'),
  })
  .optional();

const console = defineTabTool({
  capability: 'core',
  schema: {
    name: 'browser_console_messages',
    title: 'Get console messages',
    description: 'Returns all console messages',
    inputSchema: z.object({
      consoleOptions: consoleOptionsSchema,
    }),
    type: 'readOnly',
  },
  handle: async (tab, params, response) => {
    const messages = await Promise.resolve(tab.consoleMessages());

    if (messages.length === 0) {
      response.addResult('No console messages');
      return;
    }

    const filteredMessages = filterConsoleMessages(
      messages,
      params.consoleOptions
    );

    if (filteredMessages.length === 0) {
      response.addResult('No console messages match the filter criteria');
      return;
    }

    for (const message of filteredMessages) {
      response.addResult(message.toString());
    }
  },
});
export default [console];
