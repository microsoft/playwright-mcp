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

const ignoreHttpsErrors = defineTool({
  capability: 'core',

  schema: {
    name: 'browser_ignore_https_errors',
    title: 'Ignore HTTPS errors',
    description: 'Configure the browser to ignore HTTPS certificate errors. This will recreate the browser context with the new setting.',
    inputSchema: z.object({
      ignore: z.boolean().describe('Whether to ignore HTTPS certificate errors. Set to true to ignore HTTPS errors.'),
    }),
    type: 'destructive',
  },

  handle: async (context, params, response) => {
    // Update the context options in the config
    context.config.browser.contextOptions.ignoreHTTPSErrors = params.ignore;
    
    // Force recreation of the browser context by closing the current one
    await context.close();
    
    // Ensure a new tab is created with the updated context
    const tab = await context.ensureTab();
    
    response.setIncludeSnapshot();
    response.addCode(`// Configure browser to ${params.ignore ? 'ignore' : 'validate'} HTTPS certificate errors`);
    response.addCode(`// Browser context recreated with ignoreHTTPSErrors: ${params.ignore}`);
    response.addResult(`Browser context recreated with HTTPS error handling ${params.ignore ? 'disabled' : 'enabled'}`);
  },
});

export default [
  ignoreHttpsErrors,
]; 