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

import { test, expect, extensionId } from './extension-fixtures';

test.describe('tab management', () => {
  test.skip(({ protocolVersion }) => protocolVersion === 1, 'Multi-tab not supported in protocol v1');

  test(`browser_tabs new creates a new tab`, async ({ startExtensionClient, server }) => {
    server.setContent('/second.html', '<title>Second</title><body>Second page<body>', 'text/html');
    const { browserContext, client } = await startExtensionClient();

    const confirmationPagePromise = browserContext.waitForEvent('page', page => {
      return page.url().startsWith(`chrome-extension://${extensionId}/connect.html`);
    });

    const navigateResponse = client.callTool({
      name: 'browser_navigate',
      arguments: { url: server.HELLO_WORLD },
    });

    const selectorPage = await confirmationPagePromise;
    await selectorPage.locator('.tab-item', { hasText: 'Welcome' }).getByRole('button', { name: 'Connect' }).click();

    expect(await navigateResponse).toHaveResponse({
      snapshot: expect.stringContaining(`- generic [active] [ref=e1]: Hello, world!`),
    });

    // Now create a new tab via browser_tabs tool.
    const newTabResponse = await client.callTool({
      name: 'browser_tabs',
      arguments: { action: 'new', url: server.PREFIX + 'second.html' },
    });

    expect(newTabResponse).toHaveResponse({
      snapshot: expect.stringContaining(`- generic [active] [ref=e1]: Second page`),
    });

    // Verify we have two tabs by listing.
    const listResponse = await client.callTool({
      name: 'browser_tabs',
      arguments: { action: 'list' },
    });

    expect(listResponse).toHaveResponse({
      result: expect.stringMatching(/- 0: \[Title\]\(.*\/hello-world\)\n- 1: \(current\) \[Second\]\(.*\/second\.html\)/),
    });
  });

  test(`browser_tabs select switches the active tab`, async ({ startExtensionClient, server }) => {
    server.setContent('/first.html', '<title>First</title><body>First page</body>', 'text/html');
    server.setContent('/second.html', '<title>Second</title><body>Second page</body>', 'text/html');
    const { browserContext, client } = await startExtensionClient();

    const confirmationPagePromise = browserContext.waitForEvent('page', page => {
      return page.url().startsWith(`chrome-extension://${extensionId}/connect.html`);
    });

    const navigateResponse = client.callTool({
      name: 'browser_navigate',
      arguments: { url: server.PREFIX + 'first.html' },
    });

    const selectorPage = await confirmationPagePromise;
    await selectorPage.locator('.tab-item', { hasText: 'Welcome' }).getByRole('button', { name: 'Connect' }).click();
    await navigateResponse;

    // Create a second tab — it becomes the current tab.
    await client.callTool({
      name: 'browser_tabs',
      arguments: { action: 'new', url: server.PREFIX + 'second.html' },
    });

    // Switch back to the first tab via select.
    const selectResponse = await client.callTool({
      name: 'browser_tabs',
      arguments: { action: 'select', index: 0 },
    });

    expect(selectResponse).toHaveResponse({
      result: expect.stringMatching(/- 0: \(current\) \[First\]\(.*\/first\.html\)\n- 1: \[Second\]\(.*\/second\.html\)/),
    });

    // A subsequent snapshot should reflect the newly selected tab's content.
    const snapshotResponse = await client.callTool({
      name: 'browser_snapshot',
      arguments: {},
    });
    expect(snapshotResponse).toHaveResponse({
      snapshot: expect.stringContaining('First page'),
    });
  });

  test(`browser_tabs close removes a tab`, async ({ startExtensionClient, server }) => {
    server.setContent('/first.html', '<title>First</title><body>First page</body>', 'text/html');
    server.setContent('/second.html', '<title>Second</title><body>Second page</body>', 'text/html');
    const { browserContext, client } = await startExtensionClient();

    const confirmationPagePromise = browserContext.waitForEvent('page', page => {
      return page.url().startsWith(`chrome-extension://${extensionId}/connect.html`);
    });

    const navigateResponse = client.callTool({
      name: 'browser_navigate',
      arguments: { url: server.PREFIX + 'first.html' },
    });

    const selectorPage = await confirmationPagePromise;
    await selectorPage.locator('.tab-item', { hasText: 'Welcome' }).getByRole('button', { name: 'Connect' }).click();
    await navigateResponse;

    // Create a second tab — it becomes the current tab.
    await client.callTool({
      name: 'browser_tabs',
      arguments: { action: 'new', url: server.PREFIX + 'second.html' },
    });

    // Close the first tab by index.
    const closeResponse = await client.callTool({
      name: 'browser_tabs',
      arguments: { action: 'close', index: 0 },
    });

    expect(closeResponse).toHaveResponse({
      result: expect.stringMatching(/^- 0: \(current\) \[Second\]\(.*\/second\.html\)$/m),
    });

    // Only the Second tab should remain.
    const listResponse = await client.callTool({
      name: 'browser_tabs',
      arguments: { action: 'list' },
    });
    expect(listResponse).toHaveResponse({
      result: expect.not.stringContaining('First'),
    });
    expect(listResponse).toHaveResponse({
      result: expect.stringContaining('Second'),
    });
  });

  test(`cmd+click opens new tab visible in tab list`, async ({ startExtensionClient, server }) => {
    server.setContent('/link-page', '<title>LinkPage</title><body><a href="/target-page">click me</a></body>', 'text/html');
    server.setContent('/target-page', '<title>TargetPage</title><body>Target content</body>', 'text/html');
    const { browserContext, client } = await startExtensionClient();

    const confirmationPagePromise = browserContext.waitForEvent('page', page => {
      return page.url().startsWith(`chrome-extension://${extensionId}/connect.html`);
    });

    const navigateResponse = client.callTool({
      name: 'browser_navigate',
      arguments: { url: server.PREFIX + 'link-page' },
    });

    const selectorPage = await confirmationPagePromise;
    await selectorPage.locator('.tab-item', { hasText: 'Welcome' }).getByRole('button', { name: 'Connect' }).click();

    expect(await navigateResponse).toHaveResponse({
      snapshot: expect.stringContaining(`click me`),
    });

    // Cmd+click (Meta+click) to open link in a new tab.
    await client.callTool({
      name: 'browser_click',
      arguments: { element: 'click me', ref: 'e2', modifiers: ['Meta'] },
    });

    // Wait for the new tab to appear in the list.
    await expect.poll(async () => {
      const listResponse = await client.callTool({
        name: 'browser_tabs',
        arguments: { action: 'list' },
      });
      return (listResponse as any).content?.[0]?.text ?? '';
    }).toContain('TargetPage');

    const listResponse = await client.callTool({
      name: 'browser_tabs',
      arguments: { action: 'list' },
    });

    expect(listResponse).toHaveResponse({
      result: expect.stringMatching(/- 0:.*\[LinkPage\].*\n- 1:.*\[TargetPage\]/),
    });
  });

  test(`window.open from tracked tab auto-attaches new tab`, async ({ startExtensionClient, server }) => {
    server.setContent('/opener-page', `<title>Opener</title><body><button onclick="window.open('${server.PREFIX}opened-page', '_blank', 'noopener')">open</button></body>`, 'text/html');
    server.setContent('/opened-page', '<title>Opened</title><body>Opened content</body>', 'text/html');
    const { browserContext, client } = await startExtensionClient();

    const confirmationPagePromise = browserContext.waitForEvent('page', page => {
      return page.url().startsWith(`chrome-extension://${extensionId}/connect.html`);
    });

    const navigateResponse = client.callTool({
      name: 'browser_navigate',
      arguments: { url: server.PREFIX + 'opener-page' },
    });

    const selectorPage = await confirmationPagePromise;
    await selectorPage.locator('.tab-item', { hasText: 'Welcome' }).getByRole('button', { name: 'Connect' }).click();

    expect(await navigateResponse).toHaveResponse({
      snapshot: expect.stringContaining('open'),
    });

    // Click the button that calls window.open.
    await client.callTool({
      name: 'browser_click',
      arguments: { element: 'open', ref: 'e2' },
    });

    // Wait for the new tab to appear in the list.
    await expect.poll(async () => {
      const listResponse = await client.callTool({
        name: 'browser_tabs',
        arguments: { action: 'list' },
      });
      return (listResponse as any).content?.[0]?.text ?? '';
    }).toContain('Opened');

    const listResponse = await client.callTool({
      name: 'browser_tabs',
      arguments: { action: 'list' },
    });

    expect(listResponse).toHaveResponse({
      result: expect.stringMatching(/- 0:.*\[Opener\].*\n- 1:.*\[Opened\]/),
    });
  });
});
