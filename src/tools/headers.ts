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
import { defineTabTool } from './tool.js';

const setHeaders = defineTabTool({
  capability: 'headers',

  schema: {
    name: 'browser_set_headers',
    title: 'Set custom HTTP headers',
    description: 'Set custom HTTP headers for all future requests in the browser context. This is useful for multi-tenant testing where tenant identification is handled via headers.',
    inputSchema: z.object({
      headers: z.record(z.string(), z.string()).describe('Object containing header name-value pairs. For example: {"X-Tenant-ID": "tenant-123", "Authorization": "Bearer token123"}'),
    }),
    type: 'destructive',
  },

  handle: async (tab, params, response) => {
    const { headers } = params;

    // Validate headers
    if (!headers || Object.keys(headers).length === 0) {
      response.addError('No headers provided. Please provide at least one header.');
      return;
    }

    // Set the extra HTTP headers on the browser context
    await tab.page.context().setExtraHTTPHeaders(headers);

    const headersList = Object.entries(headers).map(([name, value]) => `${name}: ${value}`);
    response.addResult(`Successfully set ${headersList.length} custom header(s):`);
    headersList.forEach(header => response.addResult(`  ${header}`));
    response.addResult('These headers will be included in all future HTTP requests.');
  },
});

export default [
  setHeaders,
];

