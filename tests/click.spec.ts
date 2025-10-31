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

test('browser_click', async ({ client, server }) => {
  server.setContent('/', `
    <title>Title</title>
    <button>Submit</button>
    <script>
      const button = document.querySelector('button');
      button.addEventListener('click', () => {
        button.focus(); // without manual focus, webkit focuses body
      });
    </script>
  `, 'text/html');

  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  })).toHaveResponse({
    code: `await page.goto('${server.PREFIX}');`,
    pageState: expect.stringContaining(`- button \"Submit\" [ref=e2]`),
  });

  expect(await client.callTool({
    name: 'browser_click',
    arguments: {
      element: 'Submit button',
      ref: 'e2',
    },
  })).toHaveResponse({
    code: `await page.getByRole('button', { name: 'Submit' }).click();`,
    pageState: expect.stringContaining(`button "Submit" [active] [ref=e2]`),
  });
});
