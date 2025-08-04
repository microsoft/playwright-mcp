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

test.describe('Tabs Tools Expectation Parameter', () => {
  test.describe('browser_tab_list', () => {
    test('should accept expectation parameter with minimal response', async ({ client, server }) => {
      server.setContent('/', '<div>Test Page</div>', 'text/html');
      
      await client.callTool({
        name: 'browser_navigate',
        arguments: { url: server.PREFIX }
      });

      const result = await client.callTool({
        name: 'browser_tab_list',
        arguments: {
          expectation: {
            includeSnapshot: false,
            includeConsole: false,
            includeDownloads: false,
            includeTabs: true,
            includeCode: false
          }
        }
      });

      expect(result.content[0].text).not.toContain('Page Snapshot:');
      expect(result.content[0].text).not.toContain('Console messages');
      expect(result.content[0].text).toContain('Open tabs');
    });
  });

  test.describe('browser_tab_new', () => {
    test('should accept expectation parameter with minimal response', async ({ client, server }) => {
      server.setContent('/', '<div>Original Tab</div>', 'text/html');
      server.setContent('/new', '<div>New Tab Content</div>', 'text/html');
      
      await client.callTool({
        name: 'browser_navigate',
        arguments: { url: server.PREFIX }
      });

      const result = await client.callTool({
        name: 'browser_tab_new',
        arguments: {
          url: `${server.PREFIX}/new`,
          expectation: {
            includeSnapshot: false,
            includeConsole: false,
            includeDownloads: false,
            includeTabs: false,
            includeCode: false
          }
        }
      });

      expect(result.content[0].text).not.toContain('Page Snapshot:');
      expect(result.content[0].text).not.toContain('Console messages');
      expect(result.content[0].text).not.toContain('Open tabs');
    });

    test('should accept expectation parameter with full response', async ({ client, server }) => {
      server.setContent('/', '<div>Original Tab</div>', 'text/html');
      server.setContent('/new', '<div>New Tab Content</div>', 'text/html');
      
      await client.callTool({
        name: 'browser_navigate',
        arguments: { url: server.PREFIX }
      });

      const result = await client.callTool({
        name: 'browser_tab_new',
        arguments: {
          url: `${server.PREFIX}/new`,
          expectation: {
            includeSnapshot: true,
            includeConsole: true,
            includeDownloads: true,
            includeTabs: true,
            includeCode: true
          }
        }
      });

      expect(result.content[0].text).toContain('Page Snapshot:');
      expect(result.content[0].text).toContain('Open tabs');
    });
  });

  test.describe('browser_tab_select', () => {
    test('should accept expectation parameter with minimal response', async ({ client, server }) => {
      server.setContent('/', '<div>Tab 1</div>', 'text/html');
      server.setContent('/tab2', '<div>Tab 2</div>', 'text/html');
      
      await client.callTool({
        name: 'browser_navigate',
        arguments: { url: server.PREFIX }
      });

      await client.callTool({
        name: 'browser_tab_new',
        arguments: { url: `${server.PREFIX}/tab2` }
      });

      const result = await client.callTool({
        name: 'browser_tab_select',
        arguments: {
          index: 0,
          expectation: {
            includeSnapshot: false,
            includeConsole: false,
            includeDownloads: false,
            includeTabs: false,
            includeCode: false
          }
        }
      });

      expect(result.content[0].text).not.toContain('Page Snapshot:');
      expect(result.content[0].text).not.toContain('Console messages');
    });
  });

  test.describe('browser_tab_close', () => {
    test('should accept expectation parameter with minimal response', async ({ client, server }) => {
      server.setContent('/', '<div>Tab 1</div>', 'text/html');
      server.setContent('/tab2', '<div>Tab 2</div>', 'text/html');
      
      await client.callTool({
        name: 'browser_navigate',
        arguments: { url: server.PREFIX }
      });

      await client.callTool({
        name: 'browser_tab_new',
        arguments: { url: `${server.PREFIX}/tab2` }
      });

      const result = await client.callTool({
        name: 'browser_tab_close',
        arguments: {
          index: 1,
          expectation: {
            includeSnapshot: false,
            includeConsole: false,
            includeDownloads: false,
            includeTabs: false,
            includeCode: false
          }
        }
      });

      expect(result.content[0].text).not.toContain('Page Snapshot:');
      expect(result.content[0].text).not.toContain('Console messages');
    });
  });
});