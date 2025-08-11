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

test('browser_type', async ({ client, server, mcpBrowser }) => {
  test.skip(mcpBrowser === 'msedge', 'msedge browser setup issues');
  setServerContent(server, '/', HTML_TEMPLATES.KEYPRESS_INPUT);

  await client.callTool({
    name: 'browser_navigate',
    arguments: {
      url: server.PREFIX,
    },
  });

  {
    const response = await client.callTool({
      name: 'browser_type',
      arguments: {
        element: 'textbox',
        ref: 'e2',
        text: 'Hi!',
        submit: true,
      },
    });
    expect(response).toHaveResponse({
      code: `await page.getByRole('textbox').fill('Hi!');
await page.getByRole('textbox').press('Enter');`,
      pageState: expect.stringContaining('- textbox'),
    });
  }

  expect(
    await client.callTool({
      name: 'browser_console_messages',
    })
  ).toHaveResponse({
    result: expect.stringContaining('[LOG] Key pressed: Enter , Text: Hi!'),
  });
});

test('browser_type (slowly)', async ({ client, server, mcpBrowser }) => {
  test.skip(mcpBrowser === 'msedge', 'msedge browser setup issues');
  setServerContent(server, '/', HTML_TEMPLATES.KEYDOWN_INPUT);

  await client.callTool({
    name: 'browser_navigate',
    arguments: {
      url: server.PREFIX,
    },
  });
  {
    const response = await client.callTool({
      name: 'browser_type',
      arguments: {
        element: 'textbox',
        ref: 'e2',
        text: 'Hi!',
        slowly: true,
      },
    });

    expect(response).toHaveResponse({
      code: `await page.getByRole('textbox').pressSequentially('Hi!');`,
      pageState: expect.stringContaining('- textbox'),
    });
  }
  const response = await client.callTool({
    name: 'browser_console_messages',
  });
  expect(response).toHaveResponse({
    result: expect.stringContaining('[LOG] Key pressed: H Text: '),
  });
  expect(response).toHaveResponse({
    result: expect.stringContaining('[LOG] Key pressed: i Text: H'),
  });
  expect(response).toHaveResponse({
    result: expect.stringContaining('[LOG] Key pressed: ! Text: Hi'),
  });
});

test('browser_type (no submit)', async ({ client, server, mcpBrowser }) => {
  test.skip(mcpBrowser === 'msedge', 'msedge browser setup issues');
  setServerContent(server, '/', HTML_TEMPLATES.INPUT_WITH_CONSOLE);

  {
    const response = await client.callTool({
      name: 'browser_navigate',
      arguments: {
        url: server.PREFIX,
      },
    });
    expect(response).toHaveResponse({
      pageState: expect.stringContaining('- textbox'),
    });
  }
  {
    const response = await client.callTool({
      name: 'browser_type',
      arguments: {
        element: 'textbox',
        ref: 'e2',
        text: 'Hi!',
      },
    });
    expect(response).toHaveResponse({
      code: expect.stringContaining(`fill('Hi!')`),
      // Typing should update page state to show the new text value.
      pageState: expect.stringContaining('- textbox'),
    });
  }
  {
    const response = await client.callTool({
      name: 'browser_console_messages',
    });
    expect(response).toHaveResponse({
      result: expect.stringContaining('[LOG] New value: Hi!'),
    });
  }
});

// Regex patterns for testing code generation
const FILL_AND_ENTER_PATTERN = /fill\('[^']+'\)|press\('Enter'\)/;

// Helper function for browser_type submit tests
async function setupAndTestBrowserTypeSubmit(
  client: Awaited<ReturnType<typeof import('./fixtures.js').getClient>>,
  server: import('./testserver/index.js').TestServer,
  template: string,
  inputText: string,
  includeSnapshot = true
) {
  setServerContent(server, '/', template);

  await client.callTool({
    name: 'browser_navigate',
    arguments: {
      url: server.PREFIX,
    },
  });

  // Optionally capture snapshot first
  if (includeSnapshot) {
    await client.callTool({
      name: 'browser_snapshot',
      arguments: {
        expectation: {
          includeSnapshot: true,
        },
      },
    });
  }

  // Test typing with submit option
  const response = await client.callTool({
    name: 'browser_type',
    arguments: {
      element: 'textbox',
      ref: 'e2',
      text: inputText,
      submit: true,
      expectation: {
        includeSnapshot: true,
      },
    },
  });

  return response;
}

// Additional tests for keyboard navigation and submit functionality
test.describe('Keyboard Navigation and Submit Tests', () => {
  test('browser_type submit navigation handling', async ({
    client,
    server,
    mcpBrowser,
  }) => {
    test.skip(mcpBrowser === 'msedge', 'msedge browser setup issues');

    const response = await setupAndTestBrowserTypeSubmit(
      client,
      server,
      HTML_TEMPLATES.KEYPRESS_INPUT,
      'test query',
      true
    );

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

    const response = await setupAndTestBrowserTypeSubmit(
      client,
      server,
      HTML_TEMPLATES.INPUT_WITH_CONSOLE,
      'no navigation test',
      false
    );

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

    const response = await setupAndTestBrowserTypeSubmit(
      client,
      server,
      HTML_TEMPLATES.KEYDOWN_INPUT,
      'stability test',
      false
    );

    // Verify the operation completed successfully
    expect(response).toHaveResponse({
      code: expect.stringMatching(FILL_AND_ENTER_PATTERN),
    });

    // Verify no execution context errors occurred
    expect(response.error).toBeUndefined();
  });
});
