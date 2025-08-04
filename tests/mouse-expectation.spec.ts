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

test.describe('Mouse Tools Expectation Parameter', () => {
  test.describe('browser_mouse_move_xy', () => {
    test('should accept expectation parameter with minimal response', async ({ startClient, server }) => {
      const { client } = await startClient({ args: ['--caps=vision'] });
      server.setContent('/', '<div>Test Page</div>', 'text/html');
      
      await client.callTool({
        name: 'browser_navigate',
        arguments: { url: server.PREFIX }
      });

      const result = await client.callTool({
        name: 'browser_mouse_move_xy',
        arguments: {
          element: 'test element',
          x: 100,
          y: 200,
          expectation: {
            includeSnapshot: false,
            includeConsole: false,
            includeDownloads: false,
            includeTabs: false,
            includeCode: true
          }
        }
      });

      expect(result.content[0].text).not.toContain('Page Snapshot:');
      expect(result.content[0].text).not.toContain('Console messages');
      expect(result.content[0].text).toContain('await page.mouse.move(100, 200);');
    });

    test('should accept expectation parameter with full response', async ({ startClient, server }) => {
      const { client } = await startClient({ args: ['--caps=vision'] });
      server.setContent('/', '<div>Full Test Page</div>', 'text/html');
      
      await client.callTool({
        name: 'browser_navigate',
        arguments: { url: server.PREFIX }
      });

      const result = await client.callTool({
        name: 'browser_mouse_move_xy',
        arguments: {
          element: 'test element',
          x: 150,
          y: 250,
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
      expect(result.content[0].text).toContain('await page.mouse.move(150, 250);');
    });
  });

  test.describe('browser_mouse_click_xy', () => {
    test('should accept expectation parameter with minimal response', async ({ startClient, server }) => {
      const { client } = await startClient({ args: ['--caps=vision'] });
      server.setContent('/', '<div>Test Page</div>', 'text/html');
      
      await client.callTool({
        name: 'browser_navigate',
        arguments: { url: server.PREFIX }
      });

      const result = await client.callTool({
        name: 'browser_mouse_click_xy',
        arguments: {
          element: 'test element',
          x: 100,
          y: 200,
          expectation: {
            includeSnapshot: false,
            includeConsole: false,
            includeDownloads: false,
            includeTabs: false,
            includeCode: true
          }
        }
      });

      expect(result.content[0].text).not.toContain('Page Snapshot:');
      expect(result.content[0].text).toContain('await page.mouse.move(100, 200);');
      expect(result.content[0].text).toContain('await page.mouse.down();');
      expect(result.content[0].text).toContain('await page.mouse.up();');
    });
  });

  test.describe('browser_mouse_drag_xy', () => {
    test('should accept expectation parameter with minimal response', async ({ startClient, server }) => {
      const { client } = await startClient({ args: ['--caps=vision'] });
      server.setContent('/', '<div>Test Page</div>', 'text/html');
      
      await client.callTool({
        name: 'browser_navigate',
        arguments: { url: server.PREFIX }
      });

      const result = await client.callTool({
        name: 'browser_mouse_drag_xy',
        arguments: {
          element: 'test element',
          startX: 50,
          startY: 100,
          endX: 200,
          endY: 300,
          expectation: {
            includeSnapshot: false,
            includeConsole: false,
            includeDownloads: false,
            includeTabs: false,
            includeCode: true
          }
        }
      });

      expect(result.content[0].text).not.toContain('Page Snapshot:');
      expect(result.content[0].text).toContain('await page.mouse.move(50, 100);');
      expect(result.content[0].text).toContain('await page.mouse.down();');
      expect(result.content[0].text).toContain('await page.mouse.move(200, 300);');
      expect(result.content[0].text).toContain('await page.mouse.up();');
    });
  });
});