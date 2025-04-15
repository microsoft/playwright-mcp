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
import zodToJsonSchema from 'zod-to-json-schema';

import type { ToolFactory } from './tool';

const pressKeySchema = z.object({
  key: z.string().describe('Name of the key to press or a character to generate, such as `ArrowLeft` or `a`'),
});

const pressKey: ToolFactory = captureSnapshot => ({
  capability: 'core',
  schema: {
    name: 'browser_press_key',
    description: 'Press a key on the keyboard',
    inputSchema: zodToJsonSchema(pressKeySchema),
  },
  handle: async (context, params) => {
    const validatedParams = pressKeySchema.parse(params);
    return await context.currentTab().runAndWait(async tab => {
      await tab.page.keyboard.press(validatedParams.key);
      const code = [
        `// Press ${validatedParams.key}`,
        `await page.keyboard.press('${validatedParams.key}');`,
      ];
      return { code };
    }, {
      captureSnapshot,
    });
  },
});

export default (captureSnapshot: boolean) => [
  pressKey(captureSnapshot),
];
