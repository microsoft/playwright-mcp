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

import { test, expect } from './fixtures';

test('browser_take_screenshot defaults to PNG when type is not specified', async ({ client, server }) => {
  // Navigate to a page first
  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  });

  // Take screenshot without specifying type
  const response = await client.callTool({
    name: 'browser_take_screenshot',
    arguments: {},
  });

  // Debug: log the response structure
  console.log('Response content:', JSON.stringify(response.content, null, 2));

  // Verify the response contains content
  expect(response.content).toBeDefined();
  expect(response.content.length).toBeGreaterThan(0);

  // Find the image attachment (should be the second item)
  const hasImage = response.content.some(c => c.type === 'image');
  expect(hasImage).toBe(true);

  const imageAttachment = response.content.find(c => c.type === 'image');

  // Critical: Verify mimeType is image/png (not image/jpeg)
  expect(imageAttachment?.mimeType).toBe('image/png');

  // Verify data is present and is base64
  expect(imageAttachment?.data).toBeDefined();
  expect(typeof imageAttachment?.data).toBe('string');
  expect(imageAttachment?.data?.length).toBeGreaterThan(0);
});

test('browser_take_screenshot respects explicit PNG type', async ({ client, server }) => {
  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  });

  const response = await client.callTool({
    name: 'browser_take_screenshot',
    arguments: { type: 'png' },
  });

  const imageAttachment = response.content.find(c => c.type === 'image');
  expect(imageAttachment).toBeDefined();
  expect(imageAttachment).toHaveProperty('mimeType', 'image/png');
});

test('browser_take_screenshot respects explicit JPEG type', async ({ client, server }) => {
  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  });

  const response = await client.callTool({
    name: 'browser_take_screenshot',
    arguments: { type: 'jpeg' },
  });

  const imageAttachment = response.content.find(c => c.type === 'image');
  expect(imageAttachment).toBeDefined();
  expect(imageAttachment).toHaveProperty('mimeType', 'image/jpeg');
});
