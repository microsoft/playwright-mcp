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

test('browser_navigate', async ({ client, server }) => {
  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  })).toHaveResponse({
    code: `await page.goto('${server.HELLO_WORLD}');`,
    snapshot: expect.stringContaining(`generic [active] [ref=e1]: Hello, world!`),
  });
});

test('browser_wait_for', async ({ client, server }) => {
  server.setContent('/', `
    <title>Wait Test</title>
    <p id="status">ready</p>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  expect(await client.callTool({
    name: 'browser_wait_for',
    arguments: { text: 'ready' },
  })).toHaveResponse({
    result: 'Waited for ready',
  });
});

test('browser_wait_for times out when text is absent', async ({ startClient, server }) => {
  // Use a short action timeout so the wait fails quickly rather than blocking
  // for the full 5 s default, keeping the test suite fast.
  const { client } = await startClient({ config: { timeouts: { action: 1000 } } });

  server.setContent('/', `<title>Empty</title><p>nothing to match here</p>`, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  expect(await client.callTool({
    name: 'browser_wait_for',
    arguments: { text: 'text-that-will-never-appear' },
  })).toHaveResponse({
    isError: true,
  });
});
