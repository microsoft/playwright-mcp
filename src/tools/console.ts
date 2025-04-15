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

import type { Tool } from './tool';

const consoleSchema = z.object({});

const console: Tool = {
  capability: 'core',
  schema: {
    name: 'browser_console_messages',
    description: 'Returns all console messages',
    inputSchema: zodToJsonSchema(consoleSchema),
  },
  handle: async context => {
    const messages = await context.currentTab().console();
    const log = messages.map(message => `[${message.type().toUpperCase()}] ${message.text()}`).join('\n');
    return {
      content: [{
        type: 'text',
        text: log
      }],
    };
  },
};

export default [
  console,
];
