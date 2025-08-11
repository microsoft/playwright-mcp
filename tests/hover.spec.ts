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

test('browser_hover', async ({ client, server, mcpBrowser }) => {
  test.skip(mcpBrowser === 'msedge', 'msedge browser setup issues');
  setServerContent(server, '/', HTML_TEMPLATES.HOVER_BUTTON);

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  expect(
    await client.callTool({
      name: 'browser_hover',
      arguments: {
        element: 'Hover button',
        ref: 'e2',
      },
    })
  ).toHaveResponse({
    code: `await page.getByRole('button', { name: 'Hover me' }).hover();`,
    pageState: expect.stringContaining('- button "Hovered!"'),
  });
});

test('browser_hover (tooltip)', async ({ client, server, mcpBrowser }) => {
  test.skip(mcpBrowser === 'msedge', 'msedge browser setup issues');
  setServerContent(server, '/', HTML_TEMPLATES.HOVER_TOOLTIP);

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  const result = await client.callTool({
    name: 'browser_hover',
    arguments: {
      element: 'Hover for tooltip',
      ref: 'e2',
    },
  });

  expect(result).toHaveResponse({
    code: `await page.getByRole('button', { name: 'Hover for tooltip' }).hover();`,
    pageState: expect.stringContaining('tooltip'),
  });
});
