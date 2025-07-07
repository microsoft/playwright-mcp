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

import fs from 'fs';

import { test, expect } from './fixtures.js';

test('save HAR with auto-generated filename', async ({ startClient, server }, testInfo) => {
  const outputDir = testInfo.outputPath('output');
  const { client } = await startClient({
    config: { outputDir },
  });

  // Setup test pages
  server.setContent('/', `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Test Page</title>
        <link rel="stylesheet" href="/style.css">
      </head>
      <body>
        <button onclick="fetch('/api/data')">Fetch Data</button>
        <script src="/script.js"></script>
      </body>
    </html>
  `, 'text/html');

  server.setContent('/style.css', 'body { background: white; }', 'text/css');
  server.setContent('/script.js', 'console.log("loaded");', 'application/javascript');
  server.setContent('/api/data', JSON.stringify({ status: 'ok' }), 'application/json');

  // Navigate to the page
  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  // Trigger additional network request
  await client.callTool({
    name: 'browser_click',
    arguments: {
      element: 'Fetch Data button',
      ref: 'e2',
    },
  });

  // Save HAR file
  const response = await client.callTool({
    name: 'browser_har_save',
  });

  // Verify response format
  expect(response).toHaveTextContent(/Saved HAR file to.*session-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.har/);

  // Verify file was created
  expect(fs.existsSync(outputDir)).toBeTruthy();
  const files = fs.readdirSync(outputDir);
  const harFiles = files.filter(f => f.endsWith('.har'));
  expect(harFiles).toHaveLength(1);
  expect(harFiles[0]).toMatch(/^session-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.har$/);
});

test('save HAR with custom filename', async ({ startClient, server }, testInfo) => {
  const outputDir = testInfo.outputPath('output');
  const { client } = await startClient({
    config: { outputDir },
  });

  // Navigate to test page
  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  });

  // Save HAR with custom filename
  const response = await client.callTool({
    name: 'browser_har_save',
    arguments: {
      filename: 'my-session.har',
    },
  });

  // Verify response
  expect(response).toEqual({
    content: [
      {
        type: 'text',
        text: expect.stringContaining('my-session.har'),
      },
    ],
  });

  // Verify file exists
  const files = fs.readdirSync(outputDir);
  expect(files).toContain('my-session.har');
});

test('HAR file contains expected network requests', async ({ startClient, server }, testInfo) => {
  const outputDir = testInfo.outputPath('output');
  const { client } = await startClient({
    config: { outputDir },
  });

  // Setup test content
  server.setContent('/', '<html><body>Main Page</body></html>', 'text/html');
  server.setContent('/api/users', JSON.stringify([{ id: 1, name: 'John' }]), 'application/json');

  // Navigate and make API call
  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  // Navigate to API endpoint to trigger the request
  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: `${server.PREFIX}api/users` },
  });

  // Navigate back to main page
  await client.callTool({
    name: 'browser_navigate_back',
  });

  // Save HAR
  await client.callTool({
    name: 'browser_har_save',
    arguments: { filename: 'test.har' },
  });

  // Read and parse HAR file
  const harPath = `${outputDir}/test.har`;
  expect(fs.existsSync(harPath)).toBeTruthy();

  const harContent = JSON.parse(fs.readFileSync(harPath, 'utf8'));

  // Verify HAR structure
  expect(harContent).toHaveProperty('log');
  expect(harContent.log).toHaveProperty('version');
  expect(harContent.log).toHaveProperty('creator');
  expect(harContent.log).toHaveProperty('entries');
  expect(Array.isArray(harContent.log.entries)).toBeTruthy();

  // Verify captured requests
  const urls = harContent.log.entries.map(entry => entry.request.url);
  expect(urls).toContain(server.PREFIX);
  expect(urls).toContain(`${server.PREFIX}api/users`);

  // Verify response data is captured
  const apiEntry = harContent.log.entries.find(e => e.request.url.includes('/api/users'));
  expect(apiEntry).toBeTruthy();
  expect(apiEntry.response.status).toBe(200);
  expect(apiEntry.response.content.mimeType).toBe('application/json');
});

test('HAR captures requests across multiple navigations', async ({ startClient, server }, testInfo) => {
  const outputDir = testInfo.outputPath('output');
  const { client } = await startClient({
    config: { outputDir },
  });

  // Setup multiple pages
  server.setContent('/page1', '<html><body>Page 1</body></html>', 'text/html');
  server.setContent('/page2', '<html><body>Page 2</body></html>', 'text/html');
  server.setContent('/page3', '<html><body>Page 3</body></html>', 'text/html');

  // Navigate to multiple pages
  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: `${server.PREFIX}page1` },
  });

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: `${server.PREFIX}page2` },
  });

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: `${server.PREFIX}page3` },
  });

  // Save HAR
  await client.callTool({
    name: 'browser_har_save',
    arguments: { filename: 'multi-nav.har' },
  });

  // Verify HAR contains all navigations
  const harContent = JSON.parse(fs.readFileSync(`${outputDir}/multi-nav.har`, 'utf8'));
  const urls = harContent.log.entries.map(entry => entry.request.url);

  expect(urls).toContain(`${server.PREFIX}page1`);
  expect(urls).toContain(`${server.PREFIX}page2`);
  expect(urls).toContain(`${server.PREFIX}page3`);
});

test('HAR saving unavailable when capability disabled', async ({ startClient, server }) => {
  const { client } = await startClient({ args: ['--caps="no-har"'] });

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  });

  const response = await client.callTool({
    name: 'browser_har_save',
  });

  expect(response).toHaveTextContent(/Tool "browser_har_save" not found/);
});

test('HAR file follows proper format specification', async ({ startClient, server }, testInfo) => {
  const outputDir = testInfo.outputPath('output');
  const { client } = await startClient({
    config: { outputDir },
  });

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  });

  await client.callTool({
    name: 'browser_har_save',
    arguments: { filename: 'format-test.har' },
  });

  const harContent = JSON.parse(fs.readFileSync(`${outputDir}/format-test.har`, 'utf8'));

  // Verify required HAR fields
  expect(harContent.log.version).toBe('1.2');
  expect(harContent.log.creator).toHaveProperty('name');
  expect(harContent.log.creator).toHaveProperty('version');

  // Verify entry structure
  const entry = harContent.log.entries[0];
  expect(entry).toHaveProperty('startedDateTime');
  expect(entry).toHaveProperty('time');
  expect(entry).toHaveProperty('request');
  expect(entry).toHaveProperty('response');
  expect(entry).toHaveProperty('timings');

  // Verify request structure
  expect(entry.request).toHaveProperty('method');
  expect(entry.request).toHaveProperty('url');
  expect(entry.request).toHaveProperty('httpVersion');
  expect(entry.request).toHaveProperty('headers');
  expect(Array.isArray(entry.request.headers)).toBeTruthy();

  // Verify response structure
  expect(entry.response).toHaveProperty('status');
  expect(entry.response).toHaveProperty('statusText');
  expect(entry.response).toHaveProperty('httpVersion');
  expect(entry.response).toHaveProperty('headers');
  expect(entry.response).toHaveProperty('content');
});

test('HAR saving with no network activity', async ({ startClient }, testInfo) => {
  const outputDir = testInfo.outputPath('output');
  const { client } = await startClient({
    config: { outputDir },
  });

  // Don't navigate anywhere, just save HAR
  const response = await client.callTool({
    name: 'browser_har_save',
    arguments: { filename: 'empty.har' },
  });

  expect(response).toContainTextContent('Saved HAR file');

  // Verify HAR file exists and has empty entries
  const harContent = JSON.parse(fs.readFileSync(`${outputDir}/empty.har`, 'utf8'));
  expect(harContent.log.entries).toEqual([]);
});

test('HAR captures large number of requests', async ({ startClient, server }, testInfo) => {
  const outputDir = testInfo.outputPath('output');
  const { client } = await startClient({
    config: { outputDir },
  });

  // Setup page with many resources
  const resourceCount = 50;
  let htmlContent = '<html><head>';

  for (let i = 0; i < resourceCount; i++) {
    htmlContent += `<link rel="stylesheet" href="/css/style${i}.css">`;
    server.setContent(`/css/style${i}.css`, `/* Style ${i} */`, 'text/css');
  }

  htmlContent += '</head><body>Many Resources</body></html>';
  server.setContent('/', htmlContent, 'text/html');

  // Navigate to trigger all requests
  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  // Wait for all resources to load
  await client.callTool({
    name: 'browser_wait_for',
    arguments: { time: 2 },
  });

  // Save HAR
  await client.callTool({
    name: 'browser_har_save',
    arguments: { filename: 'large-session.har' },
  });

  // Verify all requests were captured
  const harContent = JSON.parse(fs.readFileSync(`${outputDir}/large-session.har`, 'utf8'));

  // Should have main page + all CSS files
  expect(harContent.log.entries.length).toBeGreaterThanOrEqual(resourceCount);

  // Verify CSS files are captured (check unique URLs since browsers may make duplicate requests)
  const cssRequests = harContent.log.entries.filter(e =>
    e.request.url.includes('/css/style') && e.request.url.endsWith('.css')
  );
  const uniqueCssUrls = new Set(cssRequests.map(req => req.request.url));
  expect(uniqueCssUrls.size).toBe(resourceCount);
});

test('HAR saving in new tab', async ({ startClient, server, mcpMode }, testInfo) => {
  test.skip(mcpMode === 'extension', 'Multi-tab scenarios are not supported with --extension');

  const outputDir = testInfo.outputPath('output');
  const { client } = await startClient({
    config: { outputDir },
  });

  // Setup content before navigation
  server.setContent('/about', '<html><body>About Page</body></html>', 'text/html');

  // Navigate in first tab
  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  });

  // Open new tab and navigate
  await client.callTool({
    name: 'browser_tab_new',
    arguments: { url: `${server.PREFIX}about` },
  });

  // Save HAR (should include requests from both tabs)
  await client.callTool({
    name: 'browser_har_save',
    arguments: { filename: 'multi-tab.har' },
  });

  // Verify HAR contains requests from both tabs
  const harContent = JSON.parse(fs.readFileSync(`${outputDir}/multi-tab.har`, 'utf8'));
  const urls = harContent.log.entries.map(entry => entry.request.url);

  expect(urls.some(url => url.includes('/hello-world'))).toBeTruthy();
  expect(urls.some(url => url.includes('/about'))).toBeTruthy();
});

test('HAR filtering by content type', async ({ startClient, server }, testInfo) => {
  const outputDir = testInfo.outputPath('output');
  const { client } = await startClient({
    config: { outputDir },
  });

  // Setup test page with multiple resource types
  server.setContent('/', `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Filter Test</title>
        <link rel="stylesheet" href="/style.css">
      </head>
      <body>
        <h1>Content Type Filter Test</h1>
        <script src="/script.js"></script>
        <img src="/image.png" alt="test">
      </body>
    </html>
  `, 'text/html');

  server.setContent('/style.css', 'body { color: blue; }', 'text/css');
  server.setContent('/script.js', 'console.log("hello");', 'application/javascript');
  server.setContent('/image.png', 'fake-png-data', 'image/png');

  // Navigate to trigger all requests
  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  // Save HAR filtered by JavaScript content type
  const response = await client.callTool({
    name: 'browser_har_save',
    arguments: {
      filename: 'javascript-only.har',
      contentTypes: ['application/javascript']
    },
  });

  // Verify response indicates filtering
  expect(response).toHaveTextContent(/Filters applied:.*application\/javascript/);

  // Verify HAR file was created and filtered correctly
  const harContent = JSON.parse(fs.readFileSync(`${outputDir}/javascript-only.har`, 'utf8'));
  const entries = harContent.log.entries;

  // Should only contain JavaScript file
  expect(entries.length).toBe(1);
  expect(entries[0].request.url).toMatch(/\/script\.js$/);
  expect(entries[0].response.content.mimeType).toBe('application/javascript');

  // Verify HAR comment includes filter info
  expect(harContent.log.comment).toContain('application/javascript');
});

test('HAR filtering by URL pattern', async ({ startClient, server }, testInfo) => {
  const outputDir = testInfo.outputPath('output');
  const { client } = await startClient({
    config: { outputDir },
  });

  // Setup test page with API and static resources
  server.setContent('/', `
    <!DOCTYPE html>
    <html>
      <head>
        <script src="/api/config.js"></script>
        <script src="/static/app.js"></script>
      </head>
      <body>
        <h1>URL Pattern Test</h1>
        <p>Page loaded with API and static resources</p>
      </body>
    </html>
  `, 'text/html');

  server.setContent('/static/app.js', 'console.log("app");', 'application/javascript');
  server.setContent('/api/config.js', 'window.config = {version: "1.0"};', 'application/javascript');

  // Navigate to trigger all requests automatically
  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  // Save HAR filtered by API pattern
  const response = await client.callTool({
    name: 'browser_har_save',
    arguments: {
      filename: 'api-only.har',
      urlPattern: '*/api/*'
    },
  });

  // Verify response indicates filtering
  expect(response).toHaveTextContent(/Filters applied:.*\/api\//);

  // Verify HAR file was created and filtered correctly
  const harContent = JSON.parse(fs.readFileSync(`${outputDir}/api-only.har`, 'utf8'));
  const entries = harContent.log.entries;

  // Should only contain API requests
  expect(entries.length).toBe(1);
  expect(entries.every(entry => entry.request.url.includes('/api/'))).toBeTruthy();

  const urls = entries.map(entry => entry.request.url);
  expect(urls.some(url => url.includes('/api/config.js'))).toBeTruthy();
});

test('HAR filtering with combined filters', async ({ startClient, server }, testInfo) => {
  const outputDir = testInfo.outputPath('output');
  const { client } = await startClient({
    config: { outputDir },
  });

  // Setup test page
  server.setContent('/', `
    <!DOCTYPE html>
    <html>
      <body>
        <h1>Combined Filter Test</h1>
        <script src="/api/config.js"></script>
        <script src="/static/app.js"></script>
      </body>
    </html>
  `, 'text/html');

  server.setContent('/api/config.js', 'window.config = {};', 'application/javascript');
  server.setContent('/static/app.js', 'console.log("app");', 'application/javascript');

  // Navigate to trigger requests
  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  // Save HAR with both content type and URL pattern filters
  const response = await client.callTool({
    name: 'browser_har_save',
    arguments: {
      filename: 'api-js-only.har',
      contentTypes: ['application/javascript'],
      urlPattern: '*/api/*'
    },
  });

  // Verify response indicates both filters
  expect(response).toHaveTextContent(/Filters applied:.*application\/javascript.*\/api\//);

  // Verify HAR file was created and filtered correctly
  const harContent = JSON.parse(fs.readFileSync(`${outputDir}/api-js-only.har`, 'utf8'));
  const entries = harContent.log.entries;

  // Should only contain the API JavaScript file
  expect(entries.length).toBe(1);
  expect(entries[0].request.url).toMatch(/\/api\/config\.js$/);
  expect(entries[0].response.content.mimeType).toBe('application/javascript');
});

test('HAR filtering with no matches', async ({ startClient, server }, testInfo) => {
  const outputDir = testInfo.outputPath('output');
  const { client } = await startClient({
    config: { outputDir },
  });

  // Setup simple page
  server.setContent('/', '<html><body>Empty Test</body></html>', 'text/html');

  // Navigate to trigger request
  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  // Save HAR with filter that matches nothing
  await client.callTool({
    name: 'browser_har_save',
    arguments: {
      filename: 'no-matches.har',
      contentTypes: ['application/pdf']
    },
  });

  // Verify HAR file was created with empty entries
  const harContent = JSON.parse(fs.readFileSync(`${outputDir}/no-matches.har`, 'utf8'));
  expect(harContent.log.entries).toHaveLength(0);
  expect(harContent.log.comment).toContain('application/pdf');
});
