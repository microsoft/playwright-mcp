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

test('browser_navigate', async ({ client }) => {
  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: {
      url: 'data:text/html,<html><title>Title</title><body>Hello, world!</body></html>',
    },
  })).toHaveTextContent(`
- Ran Playwright code:
\`\`\`js
// Navigate to data:text/html,<html><title>Title</title><body>Hello, world!</body></html>
await page.goto('data:text/html,<html><title>Title</title><body>Hello, world!</body></html>');
\`\`\`

- Page URL: data:text/html,<html><title>Title</title><body>Hello, world!</body></html>
- Page Title: Title
- Page Snapshot
\`\`\`yaml
- generic [ref=s1e2]: Hello, world!
\`\`\`
`
  );
});

test('browser_click', async ({ client }) => {
  await client.callTool({
    name: 'browser_navigate',
    arguments: {
      url: 'data:text/html,<html><title>Title</title><button>Submit</button></html>',
    },
  });

  expect(await client.callTool({
    name: 'browser_click',
    arguments: {
      element: 'Submit button',
      ref: 's1e3',
    },
  })).toHaveTextContent(`
- Ran Playwright code:
\`\`\`js
// Click Submit button
await page.getByRole('button', { name: 'Submit' }).click();
\`\`\`

- Page URL: data:text/html,<html><title>Title</title><button>Submit</button></html>
- Page Title: Title
- Page Snapshot
\`\`\`yaml
- button "Submit" [ref=s2e3]
\`\`\`
`);
});

test('browser_select_option', async ({ client }) => {
  await client.callTool({
    name: 'browser_navigate',
    arguments: {
      url: 'data:text/html,<html><title>Title</title><select><option value="foo">Foo</option><option value="bar">Bar</option></select></html>',
    },
  });

  expect(await client.callTool({
    name: 'browser_select_option',
    arguments: {
      element: 'Select',
      ref: 's1e3',
      values: ['bar'],
    },
  })).toHaveTextContent(`
- Ran Playwright code:
\`\`\`js
// Select options [bar] in Select
await page.getByRole('combobox').selectOption(['bar']);
\`\`\`

- Page URL: data:text/html,<html><title>Title</title><select><option value="foo">Foo</option><option value="bar">Bar</option></select></html>
- Page Title: Title
- Page Snapshot
\`\`\`yaml
- combobox [ref=s2e3]:
  - option "Foo"
  - option "Bar" [selected]
\`\`\`
`);
});

test('browser_select_option (multiple)', async ({ client }) => {
  await client.callTool({
    name: 'browser_navigate',
    arguments: {
      url: 'data:text/html,<html><title>Title</title><select multiple><option value="foo">Foo</option><option value="bar">Bar</option><option value="baz">Baz</option></select></html>',
    },
  });

  expect(await client.callTool({
    name: 'browser_select_option',
    arguments: {
      element: 'Select',
      ref: 's1e3',
      values: ['bar', 'baz'],
    },
  })).toHaveTextContent(`
- Ran Playwright code:
\`\`\`js
// Select options [bar, baz] in Select
await page.getByRole('listbox').selectOption(['bar', 'baz']);
\`\`\`

- Page URL: data:text/html,<html><title>Title</title><select multiple><option value="foo">Foo</option><option value="bar">Bar</option><option value="baz">Baz</option></select></html>
- Page Title: Title
- Page Snapshot
\`\`\`yaml
- listbox [ref=s2e3]:
  - option "Foo" [ref=s2e4]
  - option "Bar" [selected] [ref=s2e5]
  - option "Baz" [selected] [ref=s2e6]
\`\`\`
`);
});

test('browser_type', async ({ client }) => {
  await client.callTool({
    name: 'browser_navigate',
    arguments: {
      url: `data:text/html,<input type='keypress' onkeypress="console.log('Key pressed:', event.key, ', Text:', event.target.value)"></input>`,
    },
  });
  await client.callTool({
    name: 'browser_type',
    arguments: {
      element: 'textbox',
      ref: 's1e3',
      text: 'Hi!',
      submit: true,
    },
  });
  expect(await client.callTool({
    name: 'browser_console_messages',
    arguments: {},
  })).toHaveTextContent('[LOG] Key pressed: Enter , Text: Hi!');
});

test('browser_type (slowly)', async ({ client }) => {
  await client.callTool({
    name: 'browser_navigate',
    arguments: {
      url: `data:text/html,<input type='text' onkeydown="console.log('Key pressed:', event.key, 'Text:', event.target.value)"></input>`,
    },
  });
  await client.callTool({
    name: 'browser_type',
    arguments: {
      element: 'textbox',
      ref: 's1e3',
      text: 'Hi!',
      submit: true,
      slowly: true,
    },
  });
  expect(await client.callTool({
    name: 'browser_console_messages',
    arguments: {},
  })).toHaveTextContent([
    '[LOG] Key pressed: H Text: ',
    '[LOG] Key pressed: i Text: H',
    '[LOG] Key pressed: ! Text: Hi',
    '[LOG] Key pressed: Enter Text: Hi!',
  ].join('\n'));
});

test('browser_resize', async ({ client }) => {
  await client.callTool({
    name: 'browser_navigate',
    arguments: {
      url: 'data:text/html,<html><title>Resize Test</title><body><div id="size">Waiting for resize...</div><script>new ResizeObserver(() => { document.getElementById("size").textContent = `Window size: ${window.innerWidth}x${window.innerHeight}`; }).observe(document.body);</script></body></html>',
    },
  });

  const response = await client.callTool({
    name: 'browser_resize',
    arguments: {
      width: 390,
      height: 780,
    },
  });
  expect(response).toContainTextContent(`- Ran Playwright code:
\`\`\`js
// Resize browser window to 390x780
await page.setViewportSize({ width: 390, height: 780 });
\`\`\``);
  await expect.poll(() => client.callTool({ name: 'browser_snapshot', arguments: {} })).toContainTextContent('Window size: 390x780');
});
