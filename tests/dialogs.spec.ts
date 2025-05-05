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

// https://github.com/microsoft/playwright/issues/35663
test.skip(({ mcpBrowser, mcpHeadless }) => mcpBrowser === 'webkit' && mcpHeadless);

test('alert dialog', async ({ client }) => {
  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: {
      url: 'data:text/html,<html><title>Title</title><button onclick="alert(\'Alert\')">Button</button></html>',
    },
  })).toContainTextContent('- button "Button" [ref=s1e3]');

  expect(await client.callTool({
    name: 'browser_click',
    arguments: {
      element: 'Button',
      ref: 's1e3',
    },
  })).toHaveTextContent(`- Ran Playwright code:
\`\`\`js
// Click Button
await page.getByRole('button', { name: 'Button' }).click();
\`\`\`

### Modal state
- ["alert" dialog with message "Alert"]: can be handled by the "browser_handle_dialog" tool`);

  const result = await client.callTool({
    name: 'browser_handle_dialog',
    arguments: {
      accept: true,
    },
  });

  expect(result).not.toContainTextContent('### Modal state');
  expect(result).toHaveTextContent(`- Ran Playwright code:
\`\`\`js
// <internal code to handle "alert" dialog>
\`\`\`

- Page URL: data:text/html,<html><title>Title</title><button onclick="alert('Alert')">Button</button></html>
- Page Title: Title
- Page Snapshot
\`\`\`yaml
- button "Button" [ref=s2e3]
\`\`\`
`);
});

test('two alert dialogs', async ({ client }) => {
  test.fixme(true, 'Race between the dialog and ariaSnapshot');
  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: {
      url: 'data:text/html,<html><title>Title</title><button onclick="alert(\'Alert 1\');alert(\'Alert 2\');">Button</button></html>',
    },
  })).toContainTextContent('- button "Button" [ref=s1e3]');

  expect(await client.callTool({
    name: 'browser_click',
    arguments: {
      element: 'Button',
      ref: 's1e3',
    },
  })).toHaveTextContent(`- Ran Playwright code:
\`\`\`js
// Click Button
await page.getByRole('button', { name: 'Button' }).click();
\`\`\`

### Modal state
- ["alert" dialog with message "Alert 1"]: can be handled by the "browser_handle_dialog" tool`);

  const result = await client.callTool({
    name: 'browser_handle_dialog',
    arguments: {
      accept: true,
    },
  });

  expect(result).not.toContainTextContent('### Modal state');
});

test('confirm dialog (true)', async ({ client }) => {
  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: {
      url: 'data:text/html,<html><title>Title</title><button onclick="document.body.textContent = confirm(\'Confirm\')">Button</button></html>',
    },
  })).toContainTextContent('- button "Button" [ref=s1e3]');

  expect(await client.callTool({
    name: 'browser_click',
    arguments: {
      element: 'Button',
      ref: 's1e3',
    },
  })).toContainTextContent(`### Modal state
- ["confirm" dialog with message "Confirm"]: can be handled by the "browser_handle_dialog" tool`);

  const result = await client.callTool({
    name: 'browser_handle_dialog',
    arguments: {
      accept: true,
    },
  });

  expect(result).not.toContainTextContent('### Modal state');
  expect(result).toContainTextContent('// <internal code to handle "confirm" dialog>');
  expect(result).toContainTextContent(`- Page Snapshot
\`\`\`yaml
- generic [ref=s2e2]: "true"
\`\`\``);
});

test('confirm dialog (false)', async ({ client }) => {
  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: {
      url: 'data:text/html,<html><title>Title</title><button onclick="document.body.textContent = confirm(\'Confirm\')">Button</button></html>',
    },
  })).toContainTextContent('- button "Button" [ref=s1e3]');

  expect(await client.callTool({
    name: 'browser_click',
    arguments: {
      element: 'Button',
      ref: 's1e3',
    },
  })).toContainTextContent(`### Modal state
- ["confirm" dialog with message "Confirm"]: can be handled by the "browser_handle_dialog" tool`);

  const result = await client.callTool({
    name: 'browser_handle_dialog',
    arguments: {
      accept: false,
    },
  });

  expect(result).toContainTextContent(`- Page Snapshot
\`\`\`yaml
- generic [ref=s2e2]: "false"
\`\`\``);
});

test('prompt dialog', async ({ client }) => {
  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: {
      url: 'data:text/html,<html><title>Title</title><button onclick="document.body.textContent = prompt(\'Prompt\')">Button</button></html>',
    },
  })).toContainTextContent('- button "Button" [ref=s1e3]');

  expect(await client.callTool({
    name: 'browser_click',
    arguments: {
      element: 'Button',
      ref: 's1e3',
    },
  })).toContainTextContent(`### Modal state
- ["prompt" dialog with message "Prompt"]: can be handled by the "browser_handle_dialog" tool`);

  const result = await client.callTool({
    name: 'browser_handle_dialog',
    arguments: {
      accept: true,
      promptText: 'Answer',
    },
  });

  expect(result).toContainTextContent(`- Page Snapshot
\`\`\`yaml
- generic [ref=s2e2]: Answer
\`\`\``);
});
