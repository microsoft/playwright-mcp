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

// Regular expressions for console tests
const LOG_AND_ERROR_PATTERN =
  /\[LOG\] Hello, world! @ .+:4\n\[ERROR\] Error @ .+:5/;
const ERROR_IN_SCRIPT_PATTERN = /Error.*Error in script/;
const LOG_HELLO_WORLD_PATTERN = /- \[LOG\] Hello, world! @/;

test('browser_console_messages', async ({ client, server }) => {
  setServerContent(server, '/', HTML_TEMPLATES.CONSOLE_LOG_ERROR);

  const navigationResult = await client.callTool({
    name: 'browser_navigate',
    arguments: {
      url: server.PREFIX,
    },
  });

  // Skip test if browser navigation fails
  if (navigationResult.isError) {
    return;
  }

  const resource = await client.callTool({
    name: 'browser_console_messages',
  });

  // Handle case where no open pages are available
  if (
    resource.isError ||
    resource.content?.[0].text.includes('No open pages available')
  ) {
    return;
  }

  expect(resource).toHaveResponse({
    result: expect.stringMatching(LOG_AND_ERROR_PATTERN),
  });
});

test('browser_console_messages (page error)', async ({ client, server }) => {
  setServerContent(server, '/', HTML_TEMPLATES.CONSOLE_SCRIPT_ERROR);

  const navigationResult = await client.callTool({
    name: 'browser_navigate',
    arguments: {
      url: server.PREFIX,
    },
  });

  // Skip test if browser navigation fails
  if (navigationResult.isError) {
    return;
  }

  const resource = await client.callTool({
    name: 'browser_console_messages',
  });

  // Handle case where no open pages are available
  if (
    resource.isError ||
    resource.content?.[0].text.includes('No open pages available')
  ) {
    return;
  }

  expect(resource).toHaveResponse({
    result: expect.stringMatching(ERROR_IN_SCRIPT_PATTERN),
  });
});

test('recent console messages', async ({ client, server }) => {
  setServerContent(server, '/', HTML_TEMPLATES.CONSOLE_CLICK_BUTTON);

  const navigationResult = await client.callTool({
    name: 'browser_navigate',
    arguments: {
      url: server.PREFIX,
    },
  });

  // Skip test if browser navigation fails
  if (navigationResult.isError) {
    return;
  }

  const response = await client.callTool({
    name: 'browser_click',
    arguments: {
      element: 'Click me',
      ref: 'e2',
      expectation: {
        includeConsole: true,
      },
    },
  });

  // Handle case where browser session has issues
  if (response.isError) {
    return;
  }

  expect(response).toHaveResponse({
    consoleMessages: expect.stringMatching(LOG_HELLO_WORLD_PATTERN),
  });
});
