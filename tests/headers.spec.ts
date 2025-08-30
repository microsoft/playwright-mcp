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

test('test custom headers capability', async ({ startClient }) => {
  const { client } = await startClient({
    args: ['--caps=headers'],
  });
  const { tools } = await client.listTools();
  const toolNames = tools.map(t => t.name);
  expect(toolNames).toContain('browser_set_headers');
});

test('test custom headers tool not available without capability', async ({ client }) => {
  const { tools } = await client.listTools();
  const toolNames = tools.map(t => t.name);
  expect(toolNames).not.toContain('browser_set_headers');
});

test('test browser_set_headers tool sets custom headers', async ({ startClient, testServer }) => {
  const { client } = await startClient({
    args: ['--caps=headers'],
  });

  // Navigate to a test page first
  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: testServer.emptyPage() },
  });

  // Set custom headers
  const result = await client.callTool({
    name: 'browser_set_headers',
    arguments: {
      headers: {
        'X-Tenant-ID': 'tenant-123',
        'X-Custom-Header': 'test-value',
      },
    },
  });

  expect(result.content[0].type).toBe('text');
  expect(result.content[0].text).toContain('Successfully set 2 custom header(s)');
  expect(result.content[0].text).toContain('X-Tenant-ID: tenant-123');
  expect(result.content[0].text).toContain('X-Custom-Header: test-value');
});

test('test browser_set_headers validates empty headers', async ({ startClient, testServer }) => {
  const { client } = await startClient({
    args: ['--caps=headers'],
  });

  // Navigate to a test page first
  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: testServer.emptyPage() },
  });

  // Try to set empty headers
  const result = await client.callTool({
    name: 'browser_set_headers',
    arguments: {
      headers: {},
    },
  });

  expect(result.content[0].type).toBe('text');
  expect(result.content[0].text).toContain('No headers provided');
});

test('test custom headers are included in subsequent requests', async ({ startClient, testServer }) => {
  const { client } = await startClient({
    args: ['--caps=headers'],
  });

  let receivedHeaders: Record<string, string> = {};

  // Set up a route that captures headers
  testServer.setRoute('/capture-headers', (req, res) => {
    receivedHeaders = req.headers as Record<string, string>;
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<html><body>Headers captured</body></html>');
  });

  // Navigate to initial page
  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: testServer.emptyPage() },
  });

  // Set custom headers
  await client.callTool({
    name: 'browser_set_headers',
    arguments: {
      headers: {
        'X-Tenant-ID': 'tenant-456',
        'Authorization': 'Bearer test-token',
      },
    },
  });

  // Navigate to the capture page to trigger a request with headers
  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: testServer.PREFIX + '/capture-headers' },
  });

  // Check that the custom headers were included in the request
  expect(receivedHeaders['x-tenant-id']).toBe('tenant-456');
  expect(receivedHeaders['authorization']).toBe('Bearer test-token');
});

test('test headers persist across multiple requests', async ({ startClient, testServer }) => {
  const { client } = await startClient({
    args: ['--caps=headers'],
  });

  const capturedHeaders: Record<string, string>[] = [];

  // Set up routes that capture headers
  testServer.setRoute('/page1', (req, res) => {
    capturedHeaders.push(req.headers as Record<string, string>);
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<html><body>Page 1</body></html>');
  });

  testServer.setRoute('/page2', (req, res) => {
    capturedHeaders.push(req.headers as Record<string, string>);
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<html><body>Page 2</body></html>');
  });

  // Navigate to initial page
  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: testServer.emptyPage() },
  });

  // Set custom headers
  await client.callTool({
    name: 'browser_set_headers',
    arguments: {
      headers: {
        'X-Test-Header': 'persistent-value',
      },
    },
  });

  // Navigate to multiple pages
  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: testServer.PREFIX + '/page1' },
  });

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: testServer.PREFIX + '/page2' },
  });

  // Verify headers were sent with both requests
  expect(capturedHeaders).toHaveLength(2);
  expect(capturedHeaders[0]['x-test-header']).toBe('persistent-value');
  expect(capturedHeaders[1]['x-test-header']).toBe('persistent-value');
});

