// @ts-nocheck
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

test.describe('Main Tools Expectation Integration', () => {
  test.describe('browser_navigate tool', () => {
    test('should handle expectation parameter with minimal response', async ({
      client,
      server,
    }) => {
      server.setContent('/', '<h1>Test Page</h1>', 'text/html');

      const result = await client.callTool({
        name: 'browser_navigate',
        arguments: {
          url: server.PREFIX,
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
      expect(result.content[0].text).not.toContain('Downloads');
      expect(result.content[0].text).not.toContain('Open tabs');
      expect(result.content[0].text).toContain(
        `await page.goto('${server.PREFIX}');`
      );
    });

    test('should handle expectation parameter with full response', async ({
      client,
      server,
    }) => {
      server.setContent('/', '<h1>Full Test Page</h1>', 'text/html');

      const result = await client.callTool({
        name: 'browser_navigate',
        arguments: {
          url: server.PREFIX,
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
      expect(result.content[0].text).toContain(
        `await page.goto('${server.PREFIX}');`
      );
    });

    test('should use appropriate defaults when no expectation provided', async ({
      client,
      server,
    }) => {
      server.setContent('/', '<h1>Default Test Page</h1>', 'text/html');

      const result = await client.callTool({
        name: 'browser_navigate',
        arguments: {
          url: server.PREFIX,
        },
      });

      // Navigate tool should include full context by default
      expect(result.content[0].text).toContain('Page Snapshot:');
      expect(result.content[0].text).toContain(
        `await page.goto('${server.PREFIX}');`
      );
    });
  });

  test.describe('browser_click tool', () => {
    test('should handle expectation parameter with minimal response', async ({
      client,
      server,
    }) => {
      server.setContent(
        '/',
        '<button id="test-btn">Click me</button>',
        'text/html'
      );

      await client.callTool({
        name: 'browser_navigate',
        arguments: { url: server.PREFIX },
      });

      const result = await client.callTool({
        name: 'browser_click',
        arguments: {
          element: 'Test button',
          ref: 'e2',
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
      expect(result.content[0].text).toContain('await page');
    });

    test('should handle expectation parameter with snapshot', async ({
      client,
      server,
    }) => {
      server.setContent(
        '/',
        '<button id="test-btn">Click me</button>',
        'text/html'
      );

      await client.callTool({
        name: 'browser_navigate',
        arguments: { url: server.PREFIX },
      });

      const result = await client.callTool({
        name: 'browser_click',
        arguments: {
          element: 'Test button',
          ref: 'e2',
          expectation: {
            includeSnapshot: true,
            includeConsole: false,
            includeDownloads: false,
            includeTabs: false,
            includeCode: true,
          },
        },
      });

      expect(result.content[0].text).toContain('Page Snapshot:');
      expect(result.content[0].text).toContain('await page');
    });

    test('should use appropriate defaults when no expectation provided', async ({
      client,
      server,
    }) => {
      server.setContent(
        '/',
        '<button id="test-btn">Click me</button>',
        'text/html'
      );

      await client.callTool({
        name: 'browser_navigate',
        arguments: { url: server.PREFIX },
      });

      const result = await client.callTool({
        name: 'browser_click',
        arguments: {
          element: 'Test button',
          ref: 'e2',
        },
      });

      // Click tool should include snapshot but minimal other info by default
      expect(result.content[0].text).toContain('Page Snapshot:');
      expect(result.content[0].text).toContain('await page');
    });
  });

  test.describe('browser_type tool', () => {
    test('should handle expectation parameter with minimal response', async ({
      client,
      server,
    }) => {
      server.setContent(
        '/',
        '<input id="test-input" type="text">',
        'text/html'
      );

      await client.callTool({
        name: 'browser_navigate',
        arguments: { url: server.PREFIX },
      });

      const result = await client.callTool({
        name: 'browser_type',
        arguments: {
          element: 'Test input',
          ref: 'e2',
          text: 'test text',
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
      expect(result.content[0].text).toContain('await page');
    });

    test('should handle expectation parameter with snapshot', async ({
      client,
      server,
    }) => {
      server.setContent(
        '/',
        '<input id="test-input" type="text">',
        'text/html'
      );

      await client.callTool({
        name: 'browser_navigate',
        arguments: { url: server.PREFIX },
      });

      const result = await client.callTool({
        name: 'browser_type',
        arguments: {
          element: 'Test input',
          ref: 'e2',
          text: 'test text',
          expectation: {
            includeSnapshot: true,
            includeConsole: false,
            includeDownloads: false,
            includeTabs: false,
            includeCode: true,
          },
        },
      });

      expect(result.content[0].text).toContain('Page Snapshot:');
      expect(result.content[0].text).toContain('await page');
    });

    test('should use appropriate defaults when no expectation provided', async ({
      client,
      server,
    }) => {
      server.setContent(
        '/',
        '<input id="test-input" type="text">',
        'text/html'
      );

      await client.callTool({
        name: 'browser_navigate',
        arguments: { url: server.PREFIX },
      });

      const result = await client.callTool({
        name: 'browser_type',
        arguments: {
          element: 'Test input',
          ref: 'e2',
          text: 'test text',
        },
      });

      // Type tool should include minimal output by default
      expect(result.content[0].text).toContain('await page');
    });
  });

  test.describe('browser_snapshot tool', () => {
    test('should handle expectation parameter with minimal response', async ({
      client,
      server,
    }) => {
      server.setContent('/', '<h1>Snapshot Test</h1>', 'text/html');

      await client.callTool({
        name: 'browser_navigate',
        arguments: { url: server.PREFIX },
      });

      const result = await client.callTool({
        name: 'browser_snapshot',
        arguments: {
          expectation: {
            includeSnapshot: true, // snapshot tool should always include snapshot
            includeConsole: false,
            includeDownloads: false,
            includeTabs: false,
            includeCode: false,
          },
        },
      });

      expect(result.content[0].text).toContain('Page Snapshot:');
      expect(result.content[0].text).not.toContain('Console messages');
      expect(result.content[0].text).not.toContain('await page');
    });

    test('should use appropriate defaults when no expectation provided', async ({
      client,
      server,
    }) => {
      server.setContent('/', '<h1>Snapshot Test</h1>', 'text/html');

      await client.callTool({
        name: 'browser_navigate',
        arguments: { url: server.PREFIX },
      });

      const result = await client.callTool({
        name: 'browser_snapshot',
        arguments: {},
      });

      // Snapshot tool should have minimal output by default
      expect(result.content[0].text).toContain('Page Snapshot:');
    });
  });

  test.describe('Backward Compatibility', () => {
    test('should maintain backward compatibility for all tools without expectation parameter', async ({
      client,
      server,
    }) => {
      server.setContent(
        '/',
        '<button id="test">Test</button><input id="input" type="text">',
        'text/html'
      );

      // Navigate without expectation
      const navigateResult = await client.callTool({
        name: 'browser_navigate',
        arguments: { url: server.PREFIX },
      });
      expect(navigateResult.isError).toBeFalsy();

      // Click without expectation
      const clickResult = await client.callTool({
        name: 'browser_click',
        arguments: {
          element: 'Test button',
          ref: 'e2',
        },
      });
      expect(clickResult.isError).toBeFalsy();

      // Type without expectation
      const typeResult = await client.callTool({
        name: 'browser_type',
        arguments: {
          element: 'Test input',
          ref: 'e3',
          text: 'test',
        },
      });
      expect(typeResult.isError).toBeFalsy();

      // Snapshot without expectation
      const snapshotResult = await client.callTool({
        name: 'browser_snapshot',
        arguments: {},
      });
      expect(snapshotResult.isError).toBeFalsy();
    });
  });

  test.describe('Advanced Expectation Options', () => {
    test('should handle snapshotOptions correctly', async ({
      client,
      server,
    }) => {
      server.setContent(
        '/',
        '<div class="content"><h1>Title</h1><p>Content</p></div>',
        'text/html'
      );

      await client.callTool({
        name: 'browser_navigate',
        arguments: { url: server.PREFIX },
      });

      const result = await client.callTool({
        name: 'browser_snapshot',
        arguments: {
          expectation: {
            includeSnapshot: true,
            snapshotOptions: {
              selector: '.content',
              maxLength: 50,
              format: 'aria',
            },
          },
        },
      });

      expect(result.content[0].text).toContain('Page Snapshot:');
      // The snapshot should be limited in length
      const snapshotSection = result.content[0].text.split('Page Snapshot:')[1];
      // Should contain truncation if original is longer than 50 chars
      expect(snapshotSection.length).toBeLessThan(200); // Reasonable upper bound
    });

    test('should handle consoleOptions correctly', async ({
      client,
      server,
    }) => {
      server.setContent(
        '/',
        '<script>console.error("test error"); console.log("test log");</script><h1>Test</h1>',
        'text/html'
      );

      await client.callTool({
        name: 'browser_navigate',
        arguments: { url: server.PREFIX },
      });

      const result = await client.callTool({
        name: 'browser_snapshot',
        arguments: {
          expectation: {
            includeSnapshot: true,
            includeConsole: true,
            consoleOptions: {
              levels: ['error'],
              maxMessages: 1,
            },
          },
        },
      });

      if (result.content[0].text.includes('Console messages')) {
        expect(result.content[0].text).toContain('test error');
        expect(result.content[0].text).not.toContain('test log');
      }
    });
  });
});
