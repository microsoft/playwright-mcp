import { z } from 'zod';
import { defineTabTool } from './tool.js';

const console = defineTabTool({
  capability: 'core',
  schema: {
    name: 'browser_console_messages',
    title: 'Get console messages',
    description: 'Returns all console messages',
    inputSchema: z.object({}),
    type: 'readOnly',
  },
  // biome-ignore lint/suspicious/useAwait: Async function required by TabTool interface, even without await usage
  handle: async (tab, _params, response) => {
    const messages = tab.consoleMessages();
    if (messages.length === 0) {
      response.addResult('No console messages');
    } else {
      for (const message of messages) {
        response.addResult(message.toString());
      }
    }
  },
});
export default [console];
