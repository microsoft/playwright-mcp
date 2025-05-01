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

test('browser_network_requests', async ({ client, server }) => {
  server.route('/', (req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`<button onclick="fetch('/json')">Click me</button>`);
  });

  server.route('/json', (req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ name: 'John Doe' }));
  });

  await client.callTool({
    name: 'browser_navigate',
    arguments: {
      url: server.PREFIX,
    },
  });

  await client.callTool({
    name: 'browser_click',
    arguments: {
      element: 'Click me button',
      ref: 's1e3',
    },
  });

  await expect.poll(() => client.callTool({
    name: 'browser_network_requests',
    arguments: {},
  })).toHaveTextContent(`[GET] http://localhost:${server.PORT}/json => [200] OK`);
});

test('allowedRequestPatterns defaults to allow all', async ({ client, server }) => {
  server.route('/allowed', (_req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('The pages content!');
  });

  const response = await client.callTool({
    name: 'browser_navigate',
    arguments: {
      url: `${server.PREFIX}/allowed`
    },
  });

  expect(response).toContainTextContent('The pages content!');
});

test('allowedRequestPatterns blocks url', async ({ startClient }) => {
  const client = await startClient({
    args: ['--allowed-request-patterns', 'https://localhost:1234/**/*'],
  });

  const response = await client.callTool({
    name: 'browser_navigate',
    arguments: {
      url: `https://example.com/`
    },
  });

  expect(response).toHaveTextContent(/page\.goto: (Blocked by Web Inspector|NS_ERROR_FAILURE|net::ERR_BLOCKED_BY_CLIENT)/);
});

test('allowedRequestPatterns multiple entries works', async ({ startClient, server }) => {
  server.route('/allowed', (_req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('The pages content!');
  });

  const client = await startClient({
    args: ['--allowed-request-patterns', `https://example.com/foo,${server.PREFIX}/allowed,https://example.com/bar`],
  });

  const response = await client.callTool({
    name: 'browser_navigate',
    arguments: {
      url: `${server.PREFIX}/allowed`
    },
  });

  expect(response).toContainTextContent('The pages content!');
});
