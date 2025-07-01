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
import { defineTool } from './tool.js';

import type * as playwright from 'playwright';

const requests = defineTool({
  capability: 'core',

  schema: {
    name: 'browser_network_requests',
    title: 'List network requests',
    description: 'Returns all network requests since loading the page',
    inputSchema: z.object({}),
    type: 'readOnly',
  },

  handle: async context => {
    const requests = context.currentTabOrDie().requests();
    const log = [...requests.entries()].map(([request, response]) => renderRequest(request, response)).join('\n');
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

const requestDetail = defineTool({
  capability: 'core',
  schema: {
    name: 'browser_network_request_detail',
    title: 'Get network request detail',
    description: 'Returns detailed information and response body for a specific network request by URL',
    inputSchema: z.object({
      url: z.string().describe('The URL of the network request to get details for'),
    }),
    type: 'readOnly',
  },
  handle: async (context, params) => {
    const requests = context.currentTabOrDie().requests();
    let foundRequest = null;
    let foundResponse = null;
    for (const [request, response] of requests.entries()) {
      if (request.url() === params.url) {
        foundRequest = request;
        foundResponse = response;
        break;
      }
    }
    if (!foundRequest || !foundResponse) {
      return {
        code: ['// Request not found'],
        action: async () => ({
          content: [{ type: 'text', text: `Request with URL '${params.url}' not found.` }],
        }),
        captureSnapshot: false,
        waitForNetwork: false,
      };
    }
    let requestParams = '';
    try {
      const postData = foundRequest.postData();
      if (postData) {
        try {
          requestParams = JSON.stringify(JSON.parse(postData), null, 2);
        } catch {
          requestParams = postData;
        }
      }
    } catch (e) {
      requestParams = `<Failed to read request params: ${e}>`;
    }
    let responseBody = '';
    try {
      responseBody = await foundResponse.text();
    } catch (e) {
      responseBody = `<Failed to read response body: ${e}>`;
    }
    const detail = [
      `Request:`,
      `  Method: ${foundRequest.method()}`,
      `  URL: ${foundRequest.url()}`,
      `  Headers: ${JSON.stringify(foundRequest.headers(), null, 2)}`,
      requestParams ? `  Params:\n${requestParams}` : '',
      `Response:`,
      `  Status: ${foundResponse.status()} ${foundResponse.statusText()}`,
      `  Headers: ${JSON.stringify(foundResponse.headers(), null, 2)}`,
      `  Body:`,
      responseBody,
    ].filter(Boolean).join('\n');
    return {
      code: ['// <internal code to get network request detail>'],
      action: async () => ({
        content: [{ type: 'text', text: detail }],
      }),
      captureSnapshot: false,
      waitForNetwork: false,
    };
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
  requestDetail,
];
