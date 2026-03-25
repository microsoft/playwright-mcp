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

test('browser_take_screenshot', async ({ client, server }) => {
  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  });

  const response = await client.callTool({ name: 'browser_take_screenshot' });

  // The first content item is the text with result and code sections.
  expect(response.content[0].type).toBe('text');
  expect((response.content[0] as { type: string; text: string }).text).toContain('Screenshot');

  // The second content item is the image attachment.
  expect(response.content).toHaveLength(2);
  expect(response.content[1].type).toBe('image');
});
