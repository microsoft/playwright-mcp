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

import { test, expect } from './fixtures.js';

test('browser_assert_visible', async ({ client, server }) => {
  server.setContent('/', `
    <title>Title</title>
    <button>Submit</button>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  expect(await client.callTool({
    name: 'browser_assert_visible',
    arguments: {
      element: 'Submit button',
      ref: 'e2',
    },
  })).toHaveTextContent(`
- Ran Playwright code:
\`\`\`js
// Assert Submit button is visible
await expect(page.getByRole('button', { name: 'Submit' })).toBeVisible();
\`\`\`

- Page URL: ${server.PREFIX}
- Page Title: Title
`);
});

test('browser_assert_visible failure', async ({ client, server }) => {
  server.setContent('/', `
    <title>Title</title>
    <button onclick="setTimeout(() => { document.querySelector('button').style.visibility='hidden' }, 2000)">Submit</button>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  expect(await client.callTool({
    name: 'browser_click',
    arguments: {
      element: 'Submit button',
      ref: 'e2',
    },
  })).toHaveTextContent(`
- Ran Playwright code:
\`\`\`js
// Click Submit button
await page.getByRole('button', { name: 'Submit' }).click();
\`\`\`

- Page URL: ${server.PREFIX}
- Page Title: Title
- Page Snapshot
\`\`\`yaml
- button "Submit" [ref=e2]
\`\`\`
`);

  // Wait for the button to become hidden
  await new Promise(f => setTimeout(f, 3000));

  expect(await client.callTool({
    name: 'browser_assert_visible',
    arguments: {
      element: 'Submit button',
      ref: 'e2',
    },
  })).toContainTextContent(`
Error: Expected Submit button to be visible, but got "hidden".

Log:
  - Expect "to.be.visible" with timeout 5000ms
`);
});
