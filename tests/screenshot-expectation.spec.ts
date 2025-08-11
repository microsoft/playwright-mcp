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

import { test } from './fixtures.js';
import {
  executeFullPageScreenshotTest,
  executeFullScreenshotTest,
  executeMinimalScreenshotTest,
  expectFullPageScreenshotResponse,
  expectFullScreenshotResponse,
  expectMinimalScreenshotResponse,
} from './test-helpers.js';

test.describe('Screenshot Tool Expectation Parameter', () => {
  test.describe('browser_take_screenshot', () => {
    test('should accept expectation parameter with minimal response', async ({
      client,
      server,
    }) => {
      const result = await executeMinimalScreenshotTest(client, server);
      expectMinimalScreenshotResponse(result);
    });

    test('should accept expectation parameter with full response', async ({
      client,
      server,
    }) => {
      const result = await executeFullScreenshotTest(client, server);
      expectFullScreenshotResponse(result);
    });

    test('should accept expectation parameter with fullPage option', async ({
      client,
      server,
    }) => {
      const result = await executeFullPageScreenshotTest(client, server);
      expectFullPageScreenshotResponse(result);
    });
  });
});
