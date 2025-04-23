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
import { defineTool } from './tool';

import type * as playwright from 'playwright';

const requests = defineTool({
  capability: 'core',

  schema: {
    name: 'browser_network_requests',
    description: 'Returns all network requests since loading the page',
    inputSchema: z.object({}),
  },

  handle: async context => {
    const requests = context.currentTabOrDie().requests();
    const log = await Promise.all([...requests.entries()].map(async ([request, response]) => renderRequest(request, response)));
    return {
      code: [`// <internal code to list network requests>`],
      action: async () => {
        return {
          content: [{ type: 'text', text: log.join('\n\n') }]
        };
      },
      captureSnapshot: false,
      waitForNetwork: false,
    };
  },
});

async function renderRequest(request: playwright.Request, response: playwright.Response | null): Promise<string> {
  const result: string[] = [];
  result.push(`[${request.method().toUpperCase()}] ${request.url()}`);

  // Add request body if available
  const postData = request.postData();
  if (postData)
    result.push(`Request Body: ${postData}`);

  if (!response)
    return result.join('\n');

  result.push(`=> [${response.status()}] ${response.statusText()}`);

  // Add response body as text
  const body = await response.body();
  if (body) {
    const text = body.toString('utf-8');
    result.push(`Response Body: ${text}`);
  }

  return result.join('\n');
}

export default [
  requests,
];
