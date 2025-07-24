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

const performSchema = z.object({
  task: z.string().describe('The task to perform with the browser'),
});

export const perform = defineTool({
  schema: {
    name: 'browser_perform',
    title: 'Perform a task with the browser',
    description: 'Perform a task with the browser. It can click, type, export, capture screenshot, drag, hover, select options, etc.',
    inputSchema: performSchema,
    type: 'destructive',
  },

  handle: async (context, params) => {
    return await context.runTask(params.task);
  },
});
