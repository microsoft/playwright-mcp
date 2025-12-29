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

/**
 * NOTE: These tests require the Electron support implementation in the Playwright monorepo.
 * They serve as a specification for the expected behavior.
 *
 * To run these tests once Electron support is implemented:
 * npx playwright test tests/electron.spec.ts
 */

import path from 'path';
import { test, expect } from './fixtures';

const electronAppPath = path.join(__dirname, 'electron-app');

// Skip all electron tests for now - they require proper Electron setup
test.describe('Electron support @electron', () => {

  test.describe('Core browser tools with Electron', () => {

    test('can launch Electron app and take snapshot', async ({ startClient }) => {
      const { client } = await startClient({
        args: [
          '--browser=electron',
          `--electron-app=${electronAppPath}`,
          '--caps=electron',
        ],
      });

      const response = await client.callTool({
        name: 'browser_snapshot',
        arguments: {},
      });

      // Should contain the heading from our test app
      expect(response).toHaveResponse({
        pageState: expect.stringContaining('Hello Electron'),
      });
    });

    test('can click elements in Electron app', async ({ startClient }) => {
      const { client } = await startClient({
        args: [
          '--browser=electron',
          `--electron-app=${electronAppPath}`,
          '--caps=electron',
        ],
      });

      // First take snapshot to get element references
      await client.callTool({
        name: 'browser_snapshot',
        arguments: {},
      });

      // Click the test button
      const clickResponse = await client.callTool({
        name: 'browser_click',
        arguments: {
          element: 'test button',
          ref: 'e1',
        },
      });

      expect(clickResponse).not.toHaveResponse({ isError: true });
    });

    test('can take screenshot of Electron app', async ({ startClient }) => {
      const { client } = await startClient({
        args: [
          '--browser=electron',
          `--electron-app=${electronAppPath}`,
          '--caps=electron',
        ],
      });

      const response = await client.callTool({
        name: 'browser_take_screenshot',
        arguments: {},
      });

      expect(response).not.toHaveResponse({ isError: true });
      // Should have an image attachment
      expect(response.content.length).toBeGreaterThan(1);
    });

  });

  test.describe('Electron-specific tools', () => {

    test('electron_evaluate executes code in main process', async ({ startClient }) => {
      const { client } = await startClient({
        args: [
          '--browser=electron',
          `--electron-app=${electronAppPath}`,
          '--caps=electron',
        ],
      });

      const response = await client.callTool({
        name: 'electron_evaluate',
        arguments: {
          function: "() => require('electron').app.getName()",
        },
      });

      // Should return the app name from main process
      expect(response).not.toHaveResponse({ isError: true });
      expect(response.content[0].text).toBeDefined();
    });

    test('electron_windows lists all open windows', async ({ startClient }) => {
      const { client } = await startClient({
        args: [
          '--browser=electron',
          `--electron-app=${electronAppPath}`,
          '--caps=electron',
        ],
      });

      const response = await client.callTool({
        name: 'electron_windows',
        arguments: {},
      });

      expect(response).not.toHaveResponse({ isError: true });

      // Parse the response and verify window structure
      const text = response.content[0].text;
      expect(text).toContain('windows');
    });

    test('electron_app_info returns application details', async ({ startClient }) => {
      const { client } = await startClient({
        args: [
          '--browser=electron',
          `--electron-app=${electronAppPath}`,
          '--caps=electron',
        ],
      });

      const response = await client.callTool({
        name: 'electron_app_info',
        arguments: {},
      });

      expect(response).not.toHaveResponse({ isError: true });

      const text = response.content[0].text;
      // Should contain app info structure
      expect(text).toContain('name');
      expect(text).toContain('paths');
    });

  });

  test.describe('Error handling', () => {

    test('handles invalid electron_evaluate gracefully', async ({ startClient }) => {
      const { client } = await startClient({
        args: [
          '--browser=electron',
          `--electron-app=${electronAppPath}`,
          '--caps=electron',
        ],
      });

      const response = await client.callTool({
        name: 'electron_evaluate',
        arguments: {
          function: '() => { throw new Error("Test error"); }',
        },
      });

      expect(response.isError).toBe(true);
    });

    test('handles invalid window index', async ({ startClient }) => {
      const { client } = await startClient({
        args: [
          '--browser=electron',
          `--electron-app=${electronAppPath}`,
          '--caps=electron',
        ],
      });

      const response = await client.callTool({
        name: 'electron_select_window',
        arguments: { index: 999 },
      });

      expect(response.isError).toBe(true);
      expect(response.content[0].text).toContain('out of bounds');
    });

  });

});
