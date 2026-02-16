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
 * Docker MCP API endpoints test.
 *
 * This file tests every core MCP tool by calling the Playwright MCP server
 * running inside the Docker image (playwright-mcp-dev:latest) via stdio
 * (docker run -i ...). All calls go to the real server in the container.
 *
 * Run with: MCP_IN_DOCKER=1 npx playwright test docker-endpoints.spec.ts --project=chromium-docker-endpoints
 * Prerequisite: npm run docker-build (from repo root)
 */

import { test, expect } from './fixtures';

/** Logs the actual response from an endpoint to the terminal so you can see what each API returns. */
function logExampleOutput(endpoint: string, text: string, maxLen = 1200) {
  const truncated = text.length > maxLen ? text.slice(0, maxLen) + '\n... [truncated]' : text;
  console.log('\n--- ' + endpoint + ' (example output) ---\n' + truncated + '\n');
}

test.describe('Docker MCP API endpoints', () => {
  test('list_tools: MCP listTools returns all core tools from Docker server', async ({ startClient }, testInfo) => {
    const { client } = await startClient();

    // --- Endpoint: list_tools (MCP protocol) ---
    // Lists all tools the server exposes. This is the MCP "tools/list" request.
    const { tools } = await client.listTools();
    const names = tools.map(t => t.name).sort();

    const json = JSON.stringify({ toolCount: tools.length, toolNames: names }, null, 2);
    await testInfo.attach('list_tools-response.json', { body: json, contentType: 'application/json' });
    logExampleOutput('list_tools', json);

    expect(tools.length).toBeGreaterThan(0);
    expect(names).toContain('browser_navigate');
    expect(names).toContain('browser_snapshot');
    expect(names).toContain('browser_click');
  });

  test('browser_navigate: Navigate to a URL', async ({ startClient, server }, testInfo) => {
    const { client } = await startClient();

    // --- Endpoint: browser_navigate ---
    // Navigates the current tab to the given URL. Returns snapshot and generated code.
    const res = await client.callTool({
      name: 'browser_navigate',
      arguments: { url: server.HELLO_WORLD },
    });

    const text = res.content?.[0]?.type === 'text' ? res.content[0].text : JSON.stringify(res.content);
    await testInfo.attach('browser_navigate-response.txt', { body: text, contentType: 'text/plain' });
    logExampleOutput('browser_navigate', text);

    expect(res.isError).toBeFalsy();
    expect(text).toContain('Hello, world!');
  });

  test('browser_snapshot: Capture accessibility snapshot of current page', async ({ startClient, server }, testInfo) => {
    const { client } = await startClient();
    await client.callTool({ name: 'browser_navigate', arguments: { url: server.HELLO_WORLD } });

    // --- Endpoint: browser_snapshot ---
    // Returns an accessibility tree of the page (better than screenshot for automation).
    const res = await client.callTool({ name: 'browser_snapshot', arguments: {} });

    const text = res.content?.[0]?.type === 'text' ? res.content[0].text : JSON.stringify(res.content);
    await testInfo.attach('browser_snapshot-response.txt', { body: text, contentType: 'text/plain' });
    logExampleOutput('browser_snapshot', text);

    expect(res.isError).toBeFalsy();
    expect(text).toContain('Snapshot');
  });

  test('browser_click: Click an element by ref', async ({ startClient, server }, testInfo) => {
    server.setContent('/', `
      <title>Click Test</title>
      <button id="btn">Submit</button>
    `, 'text/html');
    const { client } = await startClient();
    await client.callTool({ name: 'browser_navigate', arguments: { url: server.PREFIX } });
    const snap = await client.callTool({ name: 'browser_snapshot', arguments: {} });
    const snapText = snap.content?.[0]?.type === 'text' ? snap.content[0].text : '';
    const refMatch = snapText.match(/button[^[]*\[ref=(e\d+)\]/) || snapText.match(/\[ref=(e\d+)\]/);
    const ref = refMatch ? refMatch[1] : 'e1';

    // --- Endpoint: browser_click ---
    // Clicks an element identified by ref from the snapshot (and optional element description).
    const res = await client.callTool({
      name: 'browser_click',
      arguments: { element: 'Submit button', ref },
    });

    const text = res.content?.[0]?.type === 'text' ? res.content[0].text : JSON.stringify(res.content);
    await testInfo.attach('browser_click-response.txt', { body: text, contentType: 'text/plain' });
    logExampleOutput('browser_click', text);

    expect(res.isError).toBeFalsy();
  });

  test('browser_type: Type text into an editable element', async ({ startClient, server }, testInfo) => {
    server.setContent('/', `
      <title>Type Test</title>
      <input type="text" placeholder="Name" />
    `, 'text/html');
    const { client } = await startClient();
    await client.callTool({ name: 'browser_navigate', arguments: { url: server.PREFIX } });
    const snap = await client.callTool({ name: 'browser_snapshot', arguments: {} });
    const snapText = snap.content?.[0]?.type === 'text' ? snap.content[0].text : '';
    const refMatch = snapText.match(/textbox[^[]*\[ref=(e\d+)\]/) || snapText.match(/\[ref=(e\d+)\]/);
    const ref = refMatch ? refMatch[1] : 'e1';

    // --- Endpoint: browser_type ---
    // Types text into an element (by ref). Optional: submit (Enter), slowly (char by char).
    const res = await client.callTool({
      name: 'browser_type',
      arguments: { ref, text: 'Hello MCP', element: 'Name input' },
    });

    const text = res.content?.[0]?.type === 'text' ? res.content[0].text : JSON.stringify(res.content);
    await testInfo.attach('browser_type-response.txt', { body: text, contentType: 'text/plain' });
    logExampleOutput('browser_type', text);

    expect(res.isError).toBeFalsy();
  });

  test('browser_tabs: List and manage tabs', async ({ startClient, server }, testInfo) => {
    const { client } = await startClient();
    await client.callTool({ name: 'browser_navigate', arguments: { url: server.HELLO_WORLD } });

    // --- Endpoint: browser_tabs ---
    // Lists tabs, or create/close/select by action and optional index.
    const res = await client.callTool({
      name: 'browser_tabs',
      arguments: { action: 'list' },
    });

    const text = res.content?.[0]?.type === 'text' ? res.content[0].text : JSON.stringify(res.content);
    await testInfo.attach('browser_tabs-response.txt', { body: text, contentType: 'text/plain' });
    logExampleOutput('browser_tabs', text);

    expect(res.isError).toBeFalsy();
    expect(text).toMatch(/Open tabs|### Result/);
  });

  test('browser_console_messages: Get console messages', async ({ startClient, server }, testInfo) => {
    const { client } = await startClient();
    await client.callTool({ name: 'browser_navigate', arguments: { url: server.HELLO_WORLD } });

    // --- Endpoint: browser_console_messages ---
    // Returns console messages (level: error, warning, info, debug). Optional filename to save.
    const res = await client.callTool({
      name: 'browser_console_messages',
      arguments: { level: 'info' },
    });

    const text = res.content?.[0]?.type === 'text' ? res.content[0].text : JSON.stringify(res.content);
    await testInfo.attach('browser_console_messages-response.txt', { body: text, contentType: 'text/plain' });
    logExampleOutput('browser_console_messages', text);

    expect(res.isError).toBeFalsy();
  });

  test('browser_network_requests: List network requests', async ({ startClient, server }, testInfo) => {
    const { client } = await startClient();
    await client.callTool({ name: 'browser_navigate', arguments: { url: server.HELLO_WORLD } });

    // --- Endpoint: browser_network_requests ---
    // Returns network requests since page load. includeStatic: include images/fonts/scripts.
    const res = await client.callTool({
      name: 'browser_network_requests',
      arguments: { includeStatic: false },
    });

    const text = res.content?.[0]?.type === 'text' ? res.content[0].text : JSON.stringify(res.content);
    await testInfo.attach('browser_network_requests-response.txt', { body: text, contentType: 'text/plain' });
    logExampleOutput('browser_network_requests', text);

    expect(res.isError).toBeFalsy();
  });

  test('browser_press_key: Press a key', async ({ startClient, server }, testInfo) => {
    const { client } = await startClient();
    await client.callTool({ name: 'browser_navigate', arguments: { url: server.HELLO_WORLD } });

    // --- Endpoint: browser_press_key ---
    // Presses a key (e.g. ArrowLeft, Enter, or a character).
    const res = await client.callTool({
      name: 'browser_press_key',
      arguments: { key: 'Home' },
    });

    const text = res.content?.[0]?.type === 'text' ? res.content[0].text : JSON.stringify(res.content);
    await testInfo.attach('browser_press_key-response.txt', { body: text, contentType: 'text/plain' });
    logExampleOutput('browser_press_key', text);

    expect(res.isError).toBeFalsy();
  });

  test('browser_resize: Resize browser viewport', async ({ startClient, server }, testInfo) => {
    const { client } = await startClient();
    await client.callTool({ name: 'browser_navigate', arguments: { url: server.HELLO_WORLD } });

    // --- Endpoint: browser_resize ---
    // Resizes the browser window (width x height in pixels).
    const res = await client.callTool({
      name: 'browser_resize',
      arguments: { width: 800, height: 600 },
    });

    const text = res.content?.[0]?.type === 'text' ? res.content[0].text : JSON.stringify(res.content);
    await testInfo.attach('browser_resize-response.txt', { body: text, contentType: 'text/plain' });
    logExampleOutput('browser_resize', text);

    expect(res.isError).toBeFalsy();
  });

  test('browser_take_screenshot: Take screenshot of viewport', async ({ startClient, server }, testInfo) => {
    const { client } = await startClient();
    await client.callTool({ name: 'browser_navigate', arguments: { url: server.HELLO_WORLD } });

    // --- Endpoint: browser_take_screenshot ---
    // Takes a screenshot (type: png/jpeg). Optional: filename, element+ref, fullPage.
    const res = await client.callTool({
      name: 'browser_take_screenshot',
      arguments: { type: 'png' },
    });

    const hasText = res.content?.some(c => c.type === 'text');
    const hasImage = res.content?.some(c => c.type === 'image');
    const screenshotText = hasText
      ? (res.content!.find(c => c.type === 'text') as { text: string }).text
      : `content parts: ${res.content?.length ?? 0}, hasImage: ${!!hasImage}`;
    await testInfo.attach('browser_take_screenshot-response.txt', { body: screenshotText, contentType: 'text/plain' });
    logExampleOutput('browser_take_screenshot', screenshotText);

    expect(res.isError).toBeFalsy();
  });

  test('browser_wait_for: Wait for time or text', async ({ startClient, server }, testInfo) => {
    const { client } = await startClient();
    await client.callTool({ name: 'browser_navigate', arguments: { url: server.HELLO_WORLD } });

    // --- Endpoint: browser_wait_for ---
    // Waits for time (seconds), or text to appear, or textGone to disappear.
    const res = await client.callTool({
      name: 'browser_wait_for',
      arguments: { time: 1 },
    });

    const text = res.content?.[0]?.type === 'text' ? res.content[0].text : JSON.stringify(res.content);
    await testInfo.attach('browser_wait_for-response.txt', { body: text, contentType: 'text/plain' });
    logExampleOutput('browser_wait_for', text);

    expect(res.isError).toBeFalsy();
  });

  test('browser_navigate_back: Go back in history', async ({ startClient, server }, testInfo) => {
    const { client } = await startClient();
    await client.callTool({ name: 'browser_navigate', arguments: { url: server.HELLO_WORLD } });
    server.setContent('/other', '<title>Other</title><p>Other page</p>', 'text/html');
    await client.callTool({ name: 'browser_navigate', arguments: { url: server.PREFIX + 'other' } });

    // --- Endpoint: browser_navigate_back ---
    // Navigates back to the previous page in history.
    const res = await client.callTool({ name: 'browser_navigate_back', arguments: {} });

    const text = res.content?.[0]?.type === 'text' ? res.content[0].text : JSON.stringify(res.content);
    await testInfo.attach('browser_navigate_back-response.txt', { body: text, contentType: 'text/plain' });
    logExampleOutput('browser_navigate_back', text);

    expect(res.isError).toBeFalsy();
    expect(text).toContain('Hello, world!');
  });

  test('browser_evaluate: Evaluate JavaScript on the page', async ({ startClient, server }, testInfo) => {
    const { client } = await startClient();
    await client.callTool({ name: 'browser_navigate', arguments: { url: server.HELLO_WORLD } });

    // --- Endpoint: browser_evaluate ---
    // Runs JS in the page. function: "() => { return document.title; }" or (element) => {} with ref.
    const res = await client.callTool({
      name: 'browser_evaluate',
      arguments: { function: '() => ({ title: document.title })' },
    });

    const text = res.content?.[0]?.type === 'text' ? res.content[0].text : JSON.stringify(res.content);
    await testInfo.attach('browser_evaluate-response.txt', { body: text, contentType: 'text/plain' });
    logExampleOutput('browser_evaluate', text);

    expect(res.isError).toBeFalsy();
    expect(text).toContain('Title');
  });

  test('browser_hover: Hover over an element', async ({ startClient, server }, testInfo) => {
    server.setContent('/', '<title>Hover</title><button>Hover me</button>', 'text/html');
    const { client } = await startClient();
    await client.callTool({ name: 'browser_navigate', arguments: { url: server.PREFIX } });
    const snap = await client.callTool({ name: 'browser_snapshot', arguments: {} });
    const snapText = snap.content?.[0]?.type === 'text' ? snap.content[0].text : '';
    const refMatch = snapText.match(/button[^[]*\[ref=(e\d+)\]/) || snapText.match(/\[ref=(e\d+)\]/);
    const ref = refMatch ? refMatch[1] : 'e1';

    // --- Endpoint: browser_hover ---
    // Hovers over the element identified by ref (and optional element description).
    const res = await client.callTool({
      name: 'browser_hover',
      arguments: { ref, element: 'Hover me button' },
    });

    const text = res.content?.[0]?.type === 'text' ? res.content[0].text : JSON.stringify(res.content);
    await testInfo.attach('browser_hover-response.txt', { body: text, contentType: 'text/plain' });
    logExampleOutput('browser_hover', text);

    expect(res.isError).toBeFalsy();
  });

  test('browser_run_code: Run Playwright code snippet', async ({ startClient, server }, testInfo) => {
    const { client } = await startClient();
    await client.callTool({ name: 'browser_navigate', arguments: { url: server.HELLO_WORLD } });

    // --- Endpoint: browser_run_code ---
    // Executes a JS function receiving (page). Example: async (page) => { await page.title(); }
    const res = await client.callTool({
      name: 'browser_run_code',
      arguments: {
        code: 'async (page) => ({ url: page.url(), title: await page.title() })',
      },
    });

    const text = res.content?.[0]?.type === 'text' ? res.content[0].text : JSON.stringify(res.content);
    await testInfo.attach('browser_run_code-response.txt', { body: text, contentType: 'text/plain' });
    logExampleOutput('browser_run_code', text);

    expect(res.isError).toBeFalsy();
    expect(text).toContain('Hello, world!');
  });

  test('browser_fill_form: Fill multiple form fields', async ({ startClient, server }, testInfo) => {
    server.setContent('/', `
      <title>Form</title>
      <form>
        <input name="a" type="text" />
        <input name="b" type="text" />
      </form>
    `, 'text/html');
    const { client } = await startClient();
    await client.callTool({ name: 'browser_navigate', arguments: { url: server.PREFIX } });

    // --- Endpoint: browser_fill_form ---
    // Fills multiple fields at once. fields: array of { type, name/label/placeholder, value } (type: textbox, checkbox, radio, combobox, slider).
    const res = await client.callTool({
      name: 'browser_fill_form',
      arguments: {
        fields: [
          { type: 'textbox', name: 'a', value: 'one' },
          { type: 'textbox', name: 'b', value: 'two' },
        ],
      },
    });

    const text = res.content?.[0]?.type === 'text' ? res.content[0].text : JSON.stringify(res.content);
    await testInfo.attach('browser_fill_form-response.txt', { body: text, contentType: 'text/plain' });
    logExampleOutput('browser_fill_form', text);

    expect(res.isError).toBeFalsy();
  });

  test('browser_select_option: Select option in dropdown', async ({ startClient, server }, testInfo) => {
    server.setContent('/', `
      <title>Select</title>
      <select><option value="x">X</option><option value="y">Y</option></select>
    `, 'text/html');
    const { client } = await startClient();
    await client.callTool({ name: 'browser_navigate', arguments: { url: server.PREFIX } });
    const snap = await client.callTool({ name: 'browser_snapshot', arguments: {} });
    const snapText = snap.content?.[0]?.type === 'text' ? snap.content[0].text : '';
    const refMatch = snapText.match(/\[ref=(e\d+)\]/);
    const ref = refMatch ? refMatch[1] : 'e1';

    // --- Endpoint: browser_select_option ---
    // Selects option(s) in a dropdown by ref. values: array of option values.
    const res = await client.callTool({
      name: 'browser_select_option',
      arguments: { ref, values: ['y'], element: 'Select dropdown' },
    });

    const text = res.content?.[0]?.type === 'text' ? res.content[0].text : JSON.stringify(res.content);
    await testInfo.attach('browser_select_option-response.txt', { body: text, contentType: 'text/plain' });
    logExampleOutput('browser_select_option', text);

    expect(res.isError).toBeFalsy();
  });

  test('browser_drag: Drag from one element to another', async ({ startClient, server }, testInfo) => {
    server.setContent('/', `
      <title>Drag</title>
      <div id="a" draggable="true">A</div>
      <div id="b">B</div>
    `, 'text/html');
    const { client } = await startClient();
    await client.callTool({ name: 'browser_navigate', arguments: { url: server.PREFIX } });
    const snap = await client.callTool({ name: 'browser_snapshot', arguments: {} });
    const snapText = snap.content?.[0]?.type === 'text' ? snap.content[0].text : '';
    const refs = [...snapText.matchAll(/\[ref=(e\d+)\]/g)].map(m => m[1]);
    const startRef = refs[0] ?? 'e1';
    const endRef = refs[1] ?? 'e2';

    // --- Endpoint: browser_drag ---
    // Drags from startRef to endRef (element descriptions optional for permission).
    const res = await client.callTool({
      name: 'browser_drag',
      arguments: {
        startRef,
        endRef,
        startElement: 'Source A',
        endElement: 'Target B',
      },
    });

    const text = res.content?.[0]?.type === 'text' ? res.content[0].text : JSON.stringify(res.content);
    await testInfo.attach('browser_drag-response.txt', { body: text, contentType: 'text/plain' });
    logExampleOutput('browser_drag', text);

    expect(res.isError).toBeFalsy();
  });

  test('browser_close: Close the current page', async ({ startClient, server }, testInfo) => {
    const { client } = await startClient();
    await client.callTool({ name: 'browser_navigate', arguments: { url: server.HELLO_WORLD } });

    // --- Endpoint: browser_close ---
    // Closes the current page/tab.
    const res = await client.callTool({ name: 'browser_close', arguments: {} });

    const text = res.content?.[0]?.type === 'text' ? res.content[0].text : JSON.stringify(res.content);
    await testInfo.attach('browser_close-response.txt', { body: text, contentType: 'text/plain' });
    logExampleOutput('browser_close', text);

    expect(res.isError).toBeFalsy();
  });
});
