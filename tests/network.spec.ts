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
import { Buffer } from 'node:buffer';

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

  await expect.poll(async () => {
    const result = await client.callTool({
      name: 'browser_network_requests',
      arguments: {},
    });
    return JSON.stringify(result);
  }).toContain(`${server.PORT}/json`);

  await expect.poll(async () => {
    const result = await client.callTool({
      name: 'browser_network_requests',
      arguments: {},
    });
    return JSON.stringify(result);
  }).toContain('test payload');

  await expect.poll(async () => {
    const result = await client.callTool({
      name: 'browser_network_requests',
      arguments: {},
    });
    return JSON.stringify(result);
  }).toContain('John Doe');
});

test('browser_network_requests_with_bodies', async ({ client, server }) => {
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

  await expect.poll(async () => {
    const result = await client.callTool({
      name: 'browser_network_requests',
      arguments: {},
    });
    return JSON.stringify(result);
  }).toContain(`[GET] http://localhost:${server.PORT}/query?param1=value1&param2=value2`);

  await expect.poll(async () => {
    const result = await client.callTool({
      name: 'browser_network_requests',
      arguments: {},
    });
    return JSON.stringify(result);
  }).not.toContain('Request Body:');

  await expect.poll(async () => {
    const result = await client.callTool({
      name: 'browser_network_requests',
      arguments: {},
    });
    return JSON.stringify(result);
  }).toContain('value1');
});

test('browser_network_requests_non_xhr', async ({ client, server }) => {
  // Resource contents
  const jsContent = 'console.log("Script loaded");';
  const cssContent = 'body { color: red; }';
  const imgContent = 'fake image data';

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
        </body>
      </html>
    `);
  });

  server.route('/script.js', (req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/javascript' });
    res.end(jsContent);
  });

  server.route('/style.css', (req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/css' });
    res.end(cssContent);
  });

  server.route('/image.png', (req, res) => {
    res.writeHead(200, { 'Content-Type': 'image/png' });
    res.end(Buffer.from(imgContent));
  });

  await client.callTool({
    name: 'browser_navigate',
    arguments: {
      url: server.PREFIX,
    },
  });

  // script, style, image requests should be present
  await expect.poll(async () => {
    const result = await client.callTool({
      name: 'browser_network_requests',
      arguments: {},
    });
    return JSON.stringify(result);
  }).toContain(`[GET] http://localhost:${server.PORT}/script.js`);

  await expect.poll(async () => {
    const result = await client.callTool({
      name: 'browser_network_requests',
      arguments: {},
    });
    return JSON.stringify(result);
  }).toContain(`[GET] http://localhost:${server.PORT}/style.css`);

  await expect.poll(async () => {
    const result = await client.callTool({
      name: 'browser_network_requests',
      arguments: {},
    });
    return JSON.stringify(result);
  }).toContain(`[GET] http://localhost:${server.PORT}/image.png`);

  await expect.poll(async () => {
    const result = await client.callTool({
      name: 'browser_network_requests',
      arguments: {},
    });
    return JSON.stringify(result);
  }).not.toContain('Script loaded');

  await expect.poll(async () => {
    const result = await client.callTool({
      name: 'browser_network_requests',
      arguments: {},
    });
    return JSON.stringify(result);
  }).not.toContain('red');

  await expect.poll(async () => {
    const result = await client.callTool({
      name: 'browser_network_requests',
      arguments: {},
    });
    return JSON.stringify(result);
  }).not.toContain('fake image data');

  await expect.poll(async () => {
    const result = await client.callTool({
      name: 'browser_network_requests',
      arguments: {},
    });
    return JSON.stringify(result);
  }).not.toContain('Response Body:');
});
