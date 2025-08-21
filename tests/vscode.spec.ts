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

test('browser_connect(vscode) works', async ({ startClient, playwright, browserName }) => {
  const { client } = await startClient({
    args: ['--vscode'],
  });

  const server = await playwright[browserName].launchServer();

  expect(await client.callTool({
    name: 'browser_connect',
    arguments: {
      connectionString: server.wsEndpoint(),
      lib: import.meta.resolve('playwright'),
    }
  })).toHaveResponse({
    result: 'Successfully connected.'
  });

  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: {
      url: 'data:text/html,foo'
    }
  })).toHaveResponse({
    pageState: expect.stringContaining('foo'),
  });

  await server.close();

  expect(await client.callTool({
    name: 'browser_snapshot',
    arguments: {}
  }), 'it actually used the server').toHaveResponse({
    isError: true,
    result: expect.stringContaining('ECONNREFUSED')
  });
});
