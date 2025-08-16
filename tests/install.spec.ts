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

test('browser_install', async ({ client, mcpBrowser }) => {
  test.skip(mcpBrowser !== 'chromium', 'Test only chromium');
  expect(await client.callTool({
    name: 'browser_install',
  })).toHaveResponse({
    tabs: expect.stringContaining(`No open tabs`),
  });
});

test('browser_install with progress notifications', async ({ client, mcpBrowser }) => {
  test.skip(mcpBrowser !== 'chromium', 'Test only chromium');

  // Track progress notifications if we had a way to intercept them
  // For now, just verify the tool completes successfully with progress token
  const result = await client.callTool({
    name: 'browser_install',
    _meta: { progressToken: 'test-progress-token' }
  });

  // Verify the tool completes successfully
  expect(result).toHaveProperty('content');
  expect(result.isError).not.toBe(true);
});

test('browser_install without progress token', async ({ client, mcpBrowser }) => {
  test.skip(mcpBrowser !== 'chromium', 'Test only chromium');

  // Verify tool works without progress token (backward compatibility)
  const result = await client.callTool({
    name: 'browser_install',
  });

  expect(result).toHaveProperty('content');
  expect(result.isError).not.toBe(true);
});
