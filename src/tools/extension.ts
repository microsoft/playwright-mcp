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
import open, { apps } from 'open';

const extension = defineTool({
  capability: 'core',
  schema: {
    name: 'browser_connect',
    description: 'If the user explicitly asks to connect to a running browser, use this tool to initiate the connection.',
    inputSchema: z.object({}),
  },
  handle: async context => {
    await context.connectToExtension(async url => {
      if (!process.env.IS_UNDER_TEST)
        await open(url, { app: { name: apps.chrome } });
      else
        // eslint-disable-next-line no-console
        console.error(`%%open call to: ${url}`);
    });
    return {
      resultOverride: {
        content: [{ type: 'text', text: 'Connection established' }]
      },
      code: [],
      captureSnapshot: false,
      waitForNetwork: false,
    };
  },
});

export default [
  extension,
];
