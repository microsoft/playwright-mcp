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
    const allRequests = [...requests.entries()];
    const log = await Promise.all(allRequests.map(async ([request, response]) => await renderRequest(request, response)));
    return {
      code: [`// <internal code to list network requests>`],
      action: async () => {
        return {
          content: [{ type: 'text', text: log }]
        };
      },
      captureSnapshot: false,
      waitForNetwork: false,
    };
  },
});

function shouldIncludeBody(request: playwright.Request): boolean {
  const headers = request.headers();
  return headers['content-type']?.includes('application/json')
}

async function renderRequest(request: playwright.Request, response: playwright.Response | null): Promise<string> {
  const result: string[] = [];
  result.push(`[${request.method().toUpperCase()}] ${request.url()}`);

  // Only include request/response body for application/json requests
  if (shouldIncludeBody(request)) {
    const postData = request.postData();
    if (postData)
      result.push(`Request Body: ${postData}`);
    if (response) {
      const body = await response.text();
      result.push(`Response Body: ${body}`);
    }
  }

  return result.join(' ');
}

export default [
  requests,
];
