import type * as playwright from 'playwright';
import { z } from 'zod';
import { defineTabTool } from './tool.js';

const requests = defineTabTool({
  capability: 'core',
  schema: {
    name: 'browser_network_requests',
    title: 'List network requests',
    description: 'Returns all network requests since loading the page',
    inputSchema: z.object({}),
    type: 'readOnly',
  },
  handle: async (tab, _params, response) => {
    const requestList = await Promise.resolve(tab.requests());
    for (const [req, res] of requestList.entries()) {
      response.addResult(renderRequest(req, res));
    }
  },
});
function renderRequest(
  request: playwright.Request,
  response: playwright.Response | null
) {
  const result: string[] = [];
  result.push(`[${request.method().toUpperCase()}] ${request.url()}`);
  if (response) {
    result.push(`=> [${response.status()}] ${response.statusText()}`);
  }
  return result.join(' ');
}
export default [requests];
