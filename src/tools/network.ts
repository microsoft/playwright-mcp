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
import { defineTabTool, defineTool } from './tool.js';

import type * as playwright from 'playwright';
import type { Context } from '../context.js';
import type { Response } from '../response.js';

const requests = defineTabTool({
  capability: 'core',

  schema: {
    name: 'browser_network_requests',
    title: 'List network requests',
    description: 'Returns all network requests since loading the page',
    inputSchema: z.object({}),
    type: 'readOnly',
  },

  handle: async (tab, params, response) => {
    const requests = tab.requests();
    [...requests.entries()].forEach(([req, res]) => response.addResult(renderRequest(req, res)));
  },
});

const setHeaders = defineTool({
  capability: 'core',

  schema: {
    name: 'browser_set_headers',
    title: 'Set custom headers',
    description: 'Set custom headers that will be included with all browser requests. Headers will persist for the current browser session.',
    inputSchema: z.object({
      headers: z.record(z.string(), z.string()).describe('Object containing header name-value pairs to set'),
    }),
    type: 'destructive',
  },

  handle: async (context: Context, params: { headers: Record<string, string> }, response: Response) => {
    // Set dynamic headers that will be applied to all future requests
    context.setDynamicHeaders(params.headers);

    // Add code to show what was done
    response.addCode(`// Set custom headers: ${JSON.stringify(params.headers, null, 2)}`);

    // Get all active headers (static + dynamic)
    const allHeaders = { ...context.config.network?.customHeaders, ...context.getDynamicHeaders() };

    // Add result text
    const headersList = Object.entries(params.headers).map(([key, value]) => `- ${key}: ${value}`).join('\n');
    const allHeadersList = Object.entries(allHeaders).map(([key, value]) => `- ${key}: ${value}`).join('\n');

    response.addResult(`Custom headers have been set and will be included with all future requests:\n${headersList}\n\nAll active headers:\n${allHeadersList}`);
  },
});

function renderRequest(request: playwright.Request, response: playwright.Response | null) {
  const result: string[] = [];
  result.push(`[${request.method().toUpperCase()}] ${request.url()}`);
  if (response)
    result.push(`=> [${response.status()}] ${response.statusText()}`);
  return result.join(' ');
}

export default [
  requests,
  setHeaders,
];
