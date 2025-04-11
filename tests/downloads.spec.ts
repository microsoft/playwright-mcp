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

test('downloads', async ({ client }) => {
  expect(
      await client.callTool({
        name: 'browser_navigate',
        arguments: {
          url: 'data:text/html,<a href="data:text/plain;base64,SGVsbG8sIHdvcmxkIQ==" download="foo.txt">Download</a>',
        },
      })
  ).toContainTextContent(`link "Download" [ref=s1e3]`);

  await client.callTool({
    name: 'browser_click',
    arguments: {
      element: 'Download',
      ref: 's1e3',
    },
  });

  await expect.poll(() => client.notifications).toContainEqual(expect.objectContaining({ method: 'notifications/resources/list_changed' }));

  const { resources } = await client.listResources();
  expect(resources).toContainEqual({
    description: 'Downloaded from data:text/plain;base64,SGVsbG8sIHdvcmxkIQ==',
    name: 'Browser download: foo.txt',
    uri: 'browser://downloads/foo.txt',
  });
});
