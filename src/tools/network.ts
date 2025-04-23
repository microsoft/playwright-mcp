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
    description: 'Returns XHR/Fetch API network requests since loading the page',
    inputSchema: z.object({}),
  },

  handle: async context => {
    const requests = context.currentTabOrDie().requests();

    // Filter XHR requests
    const xhrRequests = [...requests.entries()].filter(([request]) => isXhrRequest(request));

    const log = await Promise.all(xhrRequests.map(async ([request, response]) => renderRequest(request, response)));
    return {
      code: [`// <internal code to list XHR network requests>`],
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

function isXhrRequest(request: playwright.Request): boolean {
  // Check resource type if available
  const resourceType = request.resourceType();
  if (resourceType === 'xhr' || resourceType === 'fetch')
    return true;

  // Check request headers as a fallback
  const headers = request.headers();
  if (headers['x-requested-with']?.toLowerCase() === 'xmlhttprequest')
    return true;

  // Check if request was initiated by fetch or XMLHttpRequest
  return request.isNavigationRequest() === false &&
         (headers.accept?.includes('application/json') ||
          headers['content-type']?.includes('application/json'));
}

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
