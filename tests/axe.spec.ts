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

import { test, expect } from './fixtures';

test('browser_accessibility_test', async ({ client }) => {
  await client.callTool({
    name: 'browser_tab_new',
    arguments: {
      url: `data:text/html,<html lang="en"><title>Accessibility test</title><body><header><h1>Accessibility test</h1></header><main><button></button></main><footer><p>A simple footer</p></footer></body></html>`,
    },
  });

  const { content: toolOutput } = await client.callTool({
    name: 'browser_accessibility_test',
    arguments: {},
  });

  expect(toolOutput).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          text: expect.stringContaining('Ensure buttons have discernible text'),
          type: 'text',
        }),
        expect.objectContaining({
          text: expect.stringContaining('await new AxeBuilder({ page }).analyze();'),
          type: 'text',
        }),
      ])
  );
});
