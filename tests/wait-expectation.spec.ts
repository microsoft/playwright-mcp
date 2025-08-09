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

// Wait test HTML templates
const WAIT_HTML_TEMPLATES = {
  simple: '<div>Test Page</div>',
  fullTest: '<div>Full Test Page</div>',
  dynamicContent: `
    <div>Initial content</div>
    <script>
      setTimeout(() => {
        document.querySelector('div').textContent = 'Updated content';
      }, 100);
    </script>
  `,
} as const;

// Wait expectation configurations
const WAIT_EXPECTATIONS = {
  minimal: {
    includeSnapshot: false,
    includeConsole: false,
    includeDownloads: false,
    includeTabs: false,
    includeCode: true,
  },
  full: {
    includeSnapshot: true,
    includeConsole: true,
    includeDownloads: true,
    includeTabs: true,
    includeCode: true,
  },
} as const;

// Wait test setup functions
async function setupWaitPage(
  client: any,
  server: any,
  template: keyof typeof WAIT_HTML_TEMPLATES
) {
  server.setContent('/', WAIT_HTML_TEMPLATES[template], 'text/html');
  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });
}

// Wait parameter builders
const WAIT_PARAMS = {
  time: (duration: number, expectation: keyof typeof WAIT_EXPECTATIONS) => ({
    time: duration,
    expectation: WAIT_EXPECTATIONS[expectation],
  }),
  text: (text: string, expectation: keyof typeof WAIT_EXPECTATIONS) => ({
    text,
    expectation: WAIT_EXPECTATIONS[expectation],
  }),
} as const;

// Wait response assertion functions
function assertMinimalWaitResponse(result: any, expectedMessage: string) {
  expect(result.content[0].text).not.toContain('Page Snapshot:');
  expect(result.content[0].text).not.toContain('Console messages');
  expect(result.content[0].text).toContain(expectedMessage);
}

function assertFullWaitResponse(result: any, expectedMessage: string) {
  expect(result.content[0].text).toContain('Page Snapshot:');
  expect(result.content[0].text).toContain(expectedMessage);
}

test.describe('Wait Tool Expectation Parameter', () => {
  test.describe('browser_wait_for', () => {
    test('should accept expectation parameter with minimal response', async ({
      client,
      server,
    }) => {
      await setupWaitPage(client, server, 'simple');

      const result = await client.callTool({
        name: 'browser_wait_for',
        arguments: WAIT_PARAMS.time(0.1, 'minimal'),
      });

      assertMinimalWaitResponse(result, 'Waited for');
    });

    test('should accept expectation parameter with full response', async ({
      client,
      server,
    }) => {
      await setupWaitPage(client, server, 'fullTest');

      const result = await client.callTool({
        name: 'browser_wait_for',
        arguments: WAIT_PARAMS.time(0.1, 'full'),
      });

      assertFullWaitResponse(result, 'Waited for');
    });

    test('should accept expectation parameter when waiting for text', async ({
      client,
      server,
    }) => {
      await setupWaitPage(client, server, 'dynamicContent');

      const result = await client.callTool({
        name: 'browser_wait_for',
        arguments: WAIT_PARAMS.text('Updated content', 'minimal'),
      });

      assertMinimalWaitResponse(result, 'Waited for Updated content');
    });
  });
});
