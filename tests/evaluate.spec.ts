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

// Regular expression for extracting ref from page state
const REF_PATTERN = /\[ref=([^\]]+)\]/;

import {
  expectCodeAndResult,
  expectPageTitle,
  setServerContent,
} from './test-helpers.js';

// Top-level regex patterns for performance optimization
const ERROR_PATTERNS_REGEX = /not defined|Can't find variable/;

test('browser_evaluate', async ({ client, server }) => {
  expect(
    await client.callTool({
      name: 'browser_navigate',
      arguments: { url: server.HELLO_WORLD },
    })
  ).toHaveResponse(expectPageTitle());

  expect(
    await client.callTool({
      name: 'browser_evaluate',
      arguments: {
        function: '() => document.title',
      },
    })
  ).toHaveResponse(
    expectCodeAndResult(
      `await page.evaluate('() => document.title');`,
      `"Title"`
    )
  );
});

test('browser_evaluate (element)', async ({ client, server }) => {
  setServerContent(
    server,
    '/',
    `
    <div style="background-color: red">Hello, world!</div>
  `
  );
  const navResponse = await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  // Get the actual reference from the navigation response
  interface ResponseContent {
    text?: string;
  }
  const content = navResponse.content?.[0] as ResponseContent | undefined;
  const pageState = content?.text;
  const refMatch = pageState?.match(REF_PATTERN);
  const actualRef = refMatch ? refMatch[1] : 'e1';

  expect(
    await client.callTool({
      name: 'browser_evaluate',
      arguments: {
        function: 'element => element.textContent',
        element: 'text content',
        ref: actualRef,
      },
    })
  ).toHaveResponse(
    expectCodeAndResult(
      `await page.getByText('Hello, world!').evaluate('element => element.textContent');`,
      `"Hello, world!"`
    )
  );
});

test('browser_evaluate (error)', async ({ client, server }) => {
  expect(
    await client.callTool({
      name: 'browser_navigate',
      arguments: { url: server.HELLO_WORLD },
    })
  ).toHaveResponse(expectPageTitle());

  const result = await client.callTool({
    name: 'browser_evaluate',
    arguments: {
      function: '() => nonExistentVariable',
    },
  });

  expect(result.isError).toBe(true);
  expect(result.content?.[0]?.text).toContain('nonExistentVariable');
  // Check for common error patterns across browsers
  const errorText = result.content?.[0]?.text || '';
  expect(errorText).toMatch(ERROR_PATTERNS_REGEX);
});
