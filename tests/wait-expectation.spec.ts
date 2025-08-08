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

test.describe('Wait Tool Expectation Parameter', () => {
  test.describe('browser_wait_for', () => {
    test('should accept expectation parameter with minimal response', async ({
      client,
      server,
    }) => {
      server.setContent('/', '<div>Test Page</div>', 'text/html');

      await client.callTool({
        name: 'browser_navigate',
        arguments: { url: server.PREFIX },
      });

      const result = await client.callTool({
        name: 'browser_wait_for',
        arguments: {
          time: 0.1,
          expectation: {
            includeSnapshot: false,
            includeConsole: false,
            includeDownloads: false,
            includeTabs: false,
            includeCode: true,
          },
        },
      });

      expect(result.content[0].text).not.toContain('Page Snapshot:');
      expect(result.content[0].text).not.toContain('Console messages');
      expect(result.content[0].text).toContain('Waited for');
    });

    test('should accept expectation parameter with full response', async ({
      client,
      server,
    }) => {
      server.setContent('/', '<div>Full Test Page</div>', 'text/html');

      await client.callTool({
        name: 'browser_navigate',
        arguments: { url: server.PREFIX },
      });

      const result = await client.callTool({
        name: 'browser_wait_for',
        arguments: {
          time: 0.1,
          expectation: {
            includeSnapshot: true,
            includeConsole: true,
            includeDownloads: true,
            includeTabs: true,
            includeCode: true,
          },
        },
      });

      expect(result.content[0].text).toContain('Page Snapshot:');
      expect(result.content[0].text).toContain('Waited for');
    });

    test('should accept expectation parameter when waiting for text', async ({
      client,
      server,
    }) => {
      server.setContent(
        '/',
        `
        <div>Initial content</div>
        <script>
          setTimeout(() => {
            document.querySelector('div').textContent = 'Updated content';
          }, 100);
        </script>
      `,
        'text/html'
      );

      await client.callTool({
        name: 'browser_navigate',
        arguments: { url: server.PREFIX },
      });

      const result = await client.callTool({
        name: 'browser_wait_for',
        arguments: {
          text: 'Updated content',
          expectation: {
            includeSnapshot: false,
            includeConsole: false,
            includeDownloads: false,
            includeTabs: false,
            includeCode: true,
          },
        },
      });

      expect(result.content[0].text).not.toContain('Page Snapshot:');
      expect(result.content[0].text).toContain('Waited for Updated content');
    });
  });
});
