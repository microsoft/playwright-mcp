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
import { zodToJsonSchema } from 'zod-to-json-schema';

import { captureAriaSnapshot } from './utils';

import type { ToolFactory, Tool } from './tool';
import type * as playwright from 'playwright';

const mockApiSchema = z.object({
  url: z.string().describe('URL pattern to match for interception (supports glob and regex patterns)'),
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS', 'ALL']).optional()
    .describe('HTTP method to match (ALL matches any method)'),
  status: z.number().min(100).max(599).default(200)
    .describe('HTTP status code to return'),
  contentType: z.string().default('application/json')
    .describe('Content-Type header for the response'),
  body: z.string().describe('Response body content (typically JSON formatted as a string)'),
  headers: z.record(z.string()).optional()
    .describe('Additional response headers to include'),
});

export const mockApi: ToolFactory = snapshot => ({
  schema: {
    name: 'browser_mock_api',
    description: 'Mock API responses by intercepting network requests',
    inputSchema: zodToJsonSchema(mockApiSchema),
  },
  handle: async (context, params) => {
    const validatedParams = mockApiSchema.parse(params);
    const page = context.existingPage();
    
    // Generate a unique ID for this route handler
    const routeId = `route_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    
    // Create the mock response
    const mockResponse = {
      status: validatedParams.status,
      headers: {
        'Content-Type': validatedParams.contentType,
        ...(validatedParams.headers || {})
      },
      body: validatedParams.body
    };
    
    // Set up the route handler with the appropriate method filter if specified
    if (validatedParams.method && validatedParams.method !== 'ALL') {
      await page.route(validatedParams.url, (route: playwright.Route) => {
        if (route.request().method() === validatedParams.method) {
          route.fulfill(mockResponse);
        } else {
          route.continue();
        }
      }, { times: 0 });
    } else {
      await page.route(validatedParams.url, (route: playwright.Route) => {
        route.fulfill(mockResponse);
      }, { times: 0 });
    }
    
    if (snapshot) {
      return captureAriaSnapshot(context);
    }
    
    return {
      content: [{
        type: 'text',
        text: `API mock created for ${validatedParams.url}${validatedParams.method ? ` (${validatedParams.method})` : ''} with status ${validatedParams.status}`,
      }],
    };
  },
});

const clearMockSchema = z.object({
  url: z.string().optional().describe('URL pattern to remove mocking for. If not provided, all mocks will be cleared'),
});

export const clearMock: ToolFactory = snapshot => ({
  schema: {
    name: 'browser_clear_mock',
    description: 'Clear previously configured API mocks',
    inputSchema: zodToJsonSchema(clearMockSchema),
  },
  handle: async (context, params) => {
    const validatedParams = clearMockSchema.parse(params);
    const page = context.existingPage();
    
    if (validatedParams.url) {
      await page.unroute(validatedParams.url);
    } else {
      // Clear all routes - this is a bit of a hack as there's no direct "unroute all" method
      // We use a pattern that matches all URLs and then unroute it
      await page.unroute('**');
    }
    
    if (snapshot) {
      return captureAriaSnapshot(context);
    }
    
    return {
      content: [{
        type: 'text',
        text: validatedParams.url 
          ? `Cleared API mock for ${validatedParams.url}` 
          : 'Cleared all API mocks',
      }],
    };
  },
}); 