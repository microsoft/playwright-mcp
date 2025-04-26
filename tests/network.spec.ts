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

test('browser_network_requests_post_xhr', async ({ client, server }) => {
  server.route('/', (req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`<button onclick="fetch('/json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: 'test payload' })
    })">Click me</button>`);
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

  expect.poll(() => client.callTool({
    name: 'browser_network_requests',
    arguments: {},
  })).toHaveTextContent(`[POST] http://localhost:${server.PORT}/json`);

  // Check if request body is displayed
  expect.poll(() => client.callTool({
    name: 'browser_network_requests',
    arguments: {},
  })).toHaveTextContent(`Request Body: {"data":"test payload"}`);

  // Check if response body is displayed
  expect.poll(() => client.callTool({
    name: 'browser_network_requests',
    arguments: {},
  })).toHaveTextContent(`Response Body: {"name":"John Doe"}`);
});

test('browser_network_requests_get_xhr', async ({ client, server }) => {
  server.route('/', (req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`<button onclick="fetch('/query?param1=value1&param2=value2')">GET with params</button>`);
  });

  server.route('/query', (req, res) => {
    const url = new URL(req.url!, `http://${req.headers.host}`);
    const param1 = url.searchParams.get('param1');
    const param2 = url.searchParams.get('param2');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      received: {
        param1,
        param2
      }
    }));
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
      element: 'GET with params button',
      ref: 's1e3',
    },
  });

  expect.poll(() => client.callTool({
    name: 'browser_network_requests',
    arguments: {},
  })).toHaveTextContent(`[GET] http://localhost:${server.PORT}/query?param1=value1&param2=value2`);

  expect.poll(() => client.callTool({
    name: 'browser_network_requests',
    arguments: {},
  })).not.toHaveTextContent(`Request Body:`);

  expect.poll(() => client.callTool({
    name: 'browser_network_requests',
    arguments: {},
  })).toHaveTextContent(`Response Body: {"received":{"param1":"value1","param2":"value2"}}`);
});

test('browser_network_requests_ignores_non_xhr', async ({ client, server }) => {
  // Setup a page with image and script resources that should be ignored
  server.route('/', (req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
      <html>
        <head>
          <script src="/script.js"></script>
          <link rel="stylesheet" href="/style.css">
        </head>
        <body>
          <img src="/image.png">
          <button onclick="makeXhrRequest()">Make XHR</button>
          <script>
            function makeXhrRequest() {
              fetch('/api', {
                headers: { 'Content-Type': 'application/json' }
              });
            }
          </script>
        </body>
      </html>
    `);
  });

  server.route('/script.js', (req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/javascript' });
    res.end('console.log("Script loaded");');
  });

  server.route('/style.css', (req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/css' });
    res.end('body { color: red; }');
  });

  server.route('/image.png', (req, res) => {
    res.writeHead(200, { 'Content-Type': 'image/png' });
    res.end(Buffer.from('fake image data'));
  });

  server.route('/api', (req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
  });

  await client.callTool({
    name: 'browser_navigate',
    arguments: {
      url: server.PREFIX,
    },
  });

  // Verify that script, style, and image requests are NOT shown
  const initialResult = await client.callTool({
    name: 'browser_network_requests',
    arguments: {},
  });

  expect(initialResult).not.toHaveTextContent(`[GET] http://localhost:${server.PORT}/script.js`);
  expect(initialResult).not.toHaveTextContent(`[GET] http://localhost:${server.PORT}/style.css`);
  expect(initialResult).not.toHaveTextContent(`[GET] http://localhost:${server.PORT}/image.png`);

  // Make an XHR request and verify it IS shown
  await client.callTool({
    name: 'browser_click',
    arguments: {
      element: 'Make XHR button',
      ref: 's1e3',
    },
  });

  expect.poll(() => client.callTool({
    name: 'browser_network_requests',
    arguments: {},
  })).toHaveTextContent(`[GET] http://localhost:${server.PORT}/api`);
});
