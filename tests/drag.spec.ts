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

test('browser_drag', async ({ client, server, mcpBrowser }) => {
  test.skip(mcpBrowser === 'msedge', 'msedge browser setup issues');
  setServerContent(server, '/', HTML_TEMPLATES.DRAG_DROP);

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  expect(
    await client.callTool({
      name: 'browser_drag',
      arguments: {
        startElement: 'Draggable item',
        startRef: 'e2',
        endElement: 'Drop zone',
        endRef: 'e3',
      },
    })
  ).toHaveResponse({
    code: expect.stringContaining('.dragTo('),
    pageState: expect.stringContaining('Item dropped!'),
  });
});

test('browser_drag (multiple items)', async ({
  client,
  server,
  mcpBrowser,
}) => {
  test.skip(mcpBrowser === 'msedge', 'msedge browser setup issues');
  setServerContent(server, '/', HTML_TEMPLATES.MULTI_DRAG_DROP);

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  const result = await client.callTool({
    name: 'browser_drag',
    arguments: {
      startElement: 'Item 1',
      startRef: 'e2',
      endElement: 'Drop area',
      endRef: 'e4',
    },
  });

  expect(result).toHaveResponse({
    code: expect.stringContaining('dragTo'),
    pageState: expect.stringContaining('Item 1'),
  });
});
