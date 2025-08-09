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
import {
  createFullExpectation,
  createMinimalExpectation,
  createMultiTabsSetup,
  createTestPage,
  expectToolCallResponse,
  setupTabTestPages,
} from './test-utils.js';

test.describe('Tabs Tools Expectation Parameter', () => {
  test.describe('browser_tab_list', () => {
    test('should accept expectation parameter with minimal response', async ({
      client,
      server,
    }) => {
      const page = createTestPage('<div>Test Page</div>');
      server.setContent(page.path, page.content, page.contentType);

      await client.callTool({
        name: 'browser_navigate',
        arguments: { url: server.PREFIX },
      });

      const result = await client.callTool({
        name: 'browser_tab_list',
        arguments: {
          expectation: {
            ...createMinimalExpectation(),
            includeTabs: true,
          },
        },
      });

      expectToolCallResponse(result, {
        containsSnapshot: false,
        containsConsole: false,
        containsTabs: false,
      });
      expect(result.content[0].text).toContain('Open tabs');
    });
  });

  test.describe('browser_tab_new', () => {
    test('should accept expectation parameter with minimal response', async ({
      client,
      server,
    }) => {
      const originalPage = createTestPage(
        '<div>Original Tab</div>',
        'Original Tab'
      );
      const newPage = createTestPage(
        '<div>New Tab Content</div>',
        'New Tab Content'
      );
      setupTabTestPages(server, [
        { path: originalPage.path, page: originalPage },
        { path: '/new', page: newPage },
      ]);

      await client.callTool({
        name: 'browser_navigate',
        arguments: { url: server.PREFIX },
      });

      const result = await client.callTool({
        name: 'browser_tab_new',
        arguments: {
          url: `${server.PREFIX}/new`,
          expectation: createMinimalExpectation(),
        },
      });

      expectToolCallResponse(result, {
        containsSnapshot: false,
        containsConsole: false,
        containsTabs: false,
      });
    });

    test('should accept expectation parameter with full response', async ({
      client,
      server,
    }) => {
      const originalPage = createTestPage(
        '<div>Original Tab</div>',
        'Original Tab'
      );
      const newPage = createTestPage(
        '<div>New Tab Content</div>',
        'New Tab Content'
      );
      setupTabTestPages(server, [
        { path: originalPage.path, page: originalPage },
        { path: '/new', page: newPage },
      ]);

      await client.callTool({
        name: 'browser_navigate',
        arguments: { url: server.PREFIX },
      });

      const result = await client.callTool({
        name: 'browser_tab_new',
        arguments: {
          url: `${server.PREFIX}/new`,
          expectation: createFullExpectation(),
        },
      });

      expectToolCallResponse(result, {
        containsSnapshot: true,
      });
      expect(result.content[0].text).toContain('Open tabs');
    });
  });

  test.describe('browser_tab_select', () => {
    test('should accept expectation parameter with minimal response', async ({
      client,
      server,
    }) => {
      const { setupServer } = createMultiTabsSetup();
      setupServer(server);

      await client.callTool({
        name: 'browser_navigate',
        arguments: { url: server.PREFIX },
      });

      await client.callTool({
        name: 'browser_tab_new',
        arguments: { url: `${server.PREFIX}/tab2` },
      });

      const result = await client.callTool({
        name: 'browser_tab_select',
        arguments: {
          index: 0,
          expectation: createMinimalExpectation(),
        },
      });

      expectToolCallResponse(result, {
        containsSnapshot: false,
        containsConsole: false,
      });
    });
  });

  test.describe('browser_tab_close', () => {
    test('should accept expectation parameter with minimal response', async ({
      client,
      server,
    }) => {
      const { setupServer } = createMultiTabsSetup();
      setupServer(server);

      await client.callTool({
        name: 'browser_navigate',
        arguments: { url: server.PREFIX },
      });

      await client.callTool({
        name: 'browser_tab_new',
        arguments: { url: `${server.PREFIX}/tab2` },
      });

      const result = await client.callTool({
        name: 'browser_tab_close',
        arguments: {
          index: 1,
          expectation: createMinimalExpectation(),
        },
      });

      expectToolCallResponse(result, {
        containsSnapshot: false,
        containsConsole: false,
      });
    });
  });
});
