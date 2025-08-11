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

// Regex patterns for testing code generation
const FILL_AND_ENTER_PATTERN = /fill\('[^']+'\)|press\('Enter'\)/;

test('browser_type submit navigation handling', async ({
  client,
  server,
  mcpBrowser,
}) => {
  test.skip(mcpBrowser === 'msedge', 'msedge browser setup issues');

  // Use existing input template that works
  setServerContent(server, '/', HTML_TEMPLATES.KEYPRESS_INPUT);

  await client.callTool({
    name: 'browser_navigate',
    arguments: {
      url: server.PREFIX,
    },
  });

  // First capture snapshot to see the ref
  const _snapshotResponse = await client.callTool({
    name: 'browser_snapshot',
    arguments: {
      expectation: {
        includeSnapshot: true,
      },
    },
  });

  // Test typing with submit option
  const response = await client.callTool({
    name: 'browser_type',
    arguments: {
      element: 'textbox',
      ref: 'e2',
      text: 'test query',
      submit: true,
      expectation: {
        includeSnapshot: true,
      },
    },
  });

  // Verify the operation completed successfully
  expect(response).toHaveResponse({
    code: expect.stringMatching(FILL_AND_ENTER_PATTERN),
  });

  // Verify no execution context errors occurred
  expect(response.error).toBeUndefined();
});

test('browser_type submit without navigation', async ({
  client,
  server,
  mcpBrowser,
}) => {
  test.skip(mcpBrowser === 'msedge', 'msedge browser setup issues');

  // Use existing input template
  setServerContent(server, '/', HTML_TEMPLATES.INPUT_WITH_CONSOLE);

  await client.callTool({
    name: 'browser_navigate',
    arguments: {
      url: server.PREFIX,
    },
  });

  // Test typing with submit option
  const response = await client.callTool({
    name: 'browser_type',
    arguments: {
      element: 'textbox',
      ref: 'e2',
      text: 'no navigation test',
      submit: true,
      expectation: {
        includeSnapshot: true,
      },
    },
  });

  // Verify the operation completed successfully
  expect(response).toHaveResponse({
    code: expect.stringMatching(FILL_AND_ENTER_PATTERN),
  });

  // Verify no execution context errors occurred
  expect(response.error).toBeUndefined();
});

test('browser_type submit stability test', async ({
  client,
  server,
  mcpBrowser,
}) => {
  test.skip(mcpBrowser === 'msedge', 'msedge browser setup issues');

  // Use basic input for stability test
  setServerContent(server, '/', HTML_TEMPLATES.KEYDOWN_INPUT);

  await client.callTool({
    name: 'browser_navigate',
    arguments: {
      url: server.PREFIX,
    },
  });

  // Test typing with submit option for stability
  const response = await client.callTool({
    name: 'browser_type',
    arguments: {
      element: 'textbox',
      ref: 'e2',
      text: 'stability test',
      submit: true,
      expectation: {
        includeSnapshot: true,
      },
    },
  });

  // Verify the operation completed successfully
  expect(response).toHaveResponse({
    code: expect.stringMatching(FILL_AND_ENTER_PATTERN),
  });

  // Verify no execution context errors occurred
  expect(response.error).toBeUndefined();
});
