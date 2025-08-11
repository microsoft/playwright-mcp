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

import { expect, test } from './fixtures.js';
import { HTML_TEMPLATES, setServerContent } from './test-helpers.js';

test('browser_wait_for(text)', async ({ client, server }) => {
  setServerContent(server, '/', HTML_TEMPLATES.WAIT_FOR_TEXT_UPDATE);

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  await client.callTool({
    name: 'browser_click',
    arguments: {
      element: 'Click me',
      ref: 'e2',
    },
  });

  expect(
    await client.callTool({
      name: 'browser_wait_for',
      arguments: { text: 'Text to appear' },
    })
  ).toHaveResponse({
    pageState: expect.stringContaining('- generic [ref=e3]: Text to appear'),
  });
});

test('browser_wait_for(textGone)', async ({ client, server }) => {
  setServerContent(server, '/', HTML_TEMPLATES.WAIT_FOR_TEXT_UPDATE);

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  await client.callTool({
    name: 'browser_click',
    arguments: {
      element: 'Click me',
      ref: 'e2',
    },
  });

  expect(
    await client.callTool({
      name: 'browser_wait_for',
      arguments: { textGone: 'Text to disappear' },
    })
  ).toHaveResponse({
    pageState: expect.stringContaining('- generic [ref=e3]: Text to appear'),
  });
});
