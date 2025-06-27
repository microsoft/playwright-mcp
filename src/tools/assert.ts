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

import { defineTool } from './tool.js';
import { generateLocator } from './utils.js';
import { elementSchema } from './snapshot.js';

const assertVisible = defineTool({
  capability: 'testing',
  schema: {
    name: 'browser_assert_visible',
    title: 'Assert Visible',
    description: 'Assert that an element is visible on the page',
    inputSchema: elementSchema,
    type: 'readOnly',
  },

  handle: async (context, params) => {
    const tab = context.currentTabOrDie();
    const locator = tab.snapshotOrDie().refLocator(params);

    const code = [
      `// Assert ${params.element} is visible`,
      `await expect(page.${await generateLocator(locator)}).toBeVisible();`
    ];

    return {
      code,
      action: async () => {
        const result = await (locator as any)._expect('to.be.visible', { timeout: 5000 });
        if (!result.matches) {
          const error = [`Expected ${params.element} to be visible, but got "${result.received}".`];
          if (result.log?.length)
            error.push(``, `Log:`, ...result.log);
          throw new Error(error.join('\n'));
        }
      },
      captureSnapshot: false,
      waitForNetwork: false,
    };
  },
});

export default [
  assertVisible,
];
