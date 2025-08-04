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

test.describe('Evaluate Tool Expectation Parameter', () => {
  test.describe('browser_evaluate', () => {
    test('should accept expectation parameter with minimal response for page evaluation', async ({ client, server }) => {
      server.setContent('/', '<div id="test">Test Page for Evaluation</div>', 'text/html');
      
      await client.callTool({
        name: 'browser_navigate',
        arguments: { url: server.PREFIX }
      });

      const result = await client.callTool({
        name: 'browser_evaluate',
        arguments: {
          function: '() => document.getElementById("test").textContent',
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
      expect(result.content[0].text).toContain('await page.evaluate');
      expect(result.content[0].text).toContain('"Test Page for Evaluation"');
    });

    test('should accept expectation parameter with full response for page evaluation', async ({ client, server }) => {
      server.setContent('/', '<div id="test">Full Test Page</div>', 'text/html');
      
      await client.callTool({
        name: 'browser_navigate',
        arguments: { url: server.PREFIX }
      });

      const result = await client.callTool({
        name: 'browser_evaluate',
        arguments: {
          function: '() => window.location.href',
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
      expect(result.content[0].text).toContain('await page.evaluate');
      expect(result.content[0].text).toContain(server.PREFIX);
    });

    test('should accept expectation parameter for element evaluation', async ({ client, server }) => {
      server.setContent('/', `
        <div>
          <button id="btn">Click me</button>
          <span id="counter">0</span>
        </div>
      `, 'text/html');
      
      await client.callTool({
        name: 'browser_navigate',
        arguments: { url: server.PREFIX }
      });

      // First take a snapshot to get element references
      await client.callTool({
        name: 'browser_snapshot',
        arguments: {}
      });

      const result = await client.callTool({
        name: 'browser_evaluate',
        arguments: {
          function: '(element) => element.textContent',
          element: 'button with text Click me',
          ref: 'e2',
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
      expect(result.content[0].text).toContain('Click me');
    });
  });
});