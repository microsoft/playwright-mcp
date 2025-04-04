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

test('save as pdf unavailable', async ({ startClient }) => {
  const client = await startClient({ args: ['--caps="no-pdf"'] });
  await client.callTool({
    name: 'browser_navigate',
    arguments: {
      url: 'data:text/html,<html><title>Title</title><body>Hello, world!</body></html>',
    },
  });

  expect(await client.callTool({
    name: 'browser_pdf_save',
  })).toHaveTextContent(/Tool \"browser_pdf_save\" not found/);
});

test('save as pdf', async ({ client }) => {
  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: {
      url: 'data:text/html,<html><title>Title</title><body>Hello, world!</body></html>',
    },
  })).toHaveTextContent(`
Navigated to data:text/html,<html><title>Title</title><body>Hello, world!</body></html>

- Page URL: data:text/html,<html><title>Title</title><body>Hello, world!</body></html>
- Page Title: Title
- Page Snapshot
\`\`\`yaml
- text: Hello, world!
\`\`\`
`
  );

  const response = await client.callTool({
    name: 'browser_pdf_save',
  });
  expect(response).toHaveTextContent(/^Saved as.*page-[^:]+.pdf$/);
});
