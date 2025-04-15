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

test('browser://script', async ({ client }) => {
  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: {
      url: 'data:text/html,<button>Click me</button>',
    },
  })).toContainTextContent('- button \"Click me\" [ref=s1e3]');

  await client.callTool({
    name: 'browser_click',
    arguments: {
      element: 'Click me button',
      ref: 's1e3',
    },
  });

  const script = await client.readResource({
    uri: 'browser://script',
  });
  expect(script.contents).toEqual([{
    uri: 'browser://script',
    mimeType: 'application/javascript',
    text: `
await page.goto('data:text/html,<button>Click me</button>');
await page.getByRole('button', { name: 'Click me' }).click();
`.trim(),
  }]);
});
