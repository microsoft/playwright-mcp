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

import AxeBuilder from '@axe-core/playwright';
import type { Tool, ToolActionResult } from './tool';

const axeSchema = z.object({});

const axe: Tool = {
  capability: 'core',
  schema: {
    name: 'browser_accessibility_test',
    description: 'Execute an accessibility automatic assesment of the current page using axe-core.',
    inputSchema: axeSchema,
  },

  handle: async (context, params) => {
    const tab = context.currentTabOrDie();

    const code = [
      `// Execute an axe-core assesment of the current page
       await new AxeBuilder({ page }).analyze();
      `,
    ];

    const action = async (): Promise<ToolActionResult> => {
      const axeResult = await new AxeBuilder({ page: tab.page }).analyze();

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            violations: axeResult.violations,
            incomplete: axeResult.incomplete
          })
        }]
      };
    };

    return {
      code,
      action,
      captureSnapshot: false,
      waitForNetwork: false,
    };
  }
};

export default [
  axe
];
