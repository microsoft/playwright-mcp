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

const connect = defineTool({
  capability: 'vscode',

  schema: {
    name: 'browser_connect',
    title: 'Connect to a Browser',
    description: 'Connect to an open browser window using a connection string.',
    inputSchema: z.object({
      connectionString: z.string().describe('Connection string for an existing Playwright browser window, as provided by the playwright_browser_window tool or as included in test reports.'),
    }),
    type: 'readOnly',
  },

  handle: async (context, params, response) => {
    // TODO: this should probably open a new context instead of reconnecting an existing one.
    // in the future, connectionString will contain a path to a Playwright installation that we can require,
    // to ensure we're using the same version of Playwright.
    await context.connectToWindow(params.connectionString);
    response.setIncludeSnapshot();
    response.addCode(`// Connect to existing window with connection string`);
  },
});

export default [
  connect,
];
