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
  executeMouseClickTest,
  executeMouseDragTest,
  executeMouseMoveTest,
  expectMouseClickCode,
  expectMouseDragCode,
  expectMouseMoveCode,
  MOUSE_EXPECTATIONS,
  MOUSE_HTML_TEMPLATES,
  setupMouseTest,
} from './test-helpers.js';

test.describe('Mouse Tools Expectation Parameter', () => {
  test.describe('browser_mouse_move_xy', () => {
    test('should accept expectation parameter with minimal response', async ({
      startClient,
      server,
    }) => {
      const { client } = await startClient({ args: ['--caps=vision'] });
      const result = await executeMouseMoveTest(client, server, 100, 200);
      expectMouseMoveCode(result, 100, 200);
    });

    test('should accept expectation parameter with full response', async ({
      startClient,
      server,
    }) => {
      const { client } = await startClient({ args: ['--caps=vision'] });
      const result = await setupMouseTest(
        client,
        server,
        'browser_mouse_move_xy',
        {
          element: 'test element',
          x: 150,
          y: 250,
          expectation: MOUSE_EXPECTATIONS.FULL_RESPONSE,
        },
        MOUSE_HTML_TEMPLATES.FULL_TEST
      );

      expect(result.content[0].text).toContain('Page Snapshot:');
      expect(result.content[0].text).toContain(
        'await page.mouse.move(150, 250);'
      );
    });
  });

  test.describe('browser_mouse_click_xy', () => {
    test('should accept expectation parameter with minimal response', async ({
      startClient,
      server,
    }) => {
      const { client } = await startClient({ args: ['--caps=vision'] });
      const result = await executeMouseClickTest(client, server, 100, 200);
      expectMouseClickCode(result, 100, 200);
    });
  });

  test.describe('browser_mouse_drag_xy', () => {
    test('should accept expectation parameter with minimal response', async ({
      startClient,
      server,
    }) => {
      const { client } = await startClient({ args: ['--caps=vision'] });
      const result = await executeMouseDragTest(
        client,
        server,
        50,
        100,
        200,
        300
      );
      expectMouseDragCode(result, 50, 100, 200, 300);
    });
  });
});
