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

import { expect, test } from './fixtures.js';
import {
  createButtonPage,
  extractSessionFolder,
  readSessionLog,
} from './test-utils.js';

test('session log should record tool calls', async ({
  startClient,
  server,
}, testInfo) => {
  const { client, stderr } = await startClient({
    args: ['--save-session', '--output-dir', testInfo.outputPath('output')],
  });

  const page = createButtonPage('Submit');
  server.setContent(page.path, page.content, page.contentType);

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  expect(
    await client.callTool({
      name: 'browser_click',
      arguments: {
        element: 'Submit button',
        ref: 'e2',
      },
    })
  ).toHaveResponse({
    code: `await page.getByRole('button', { name: 'Submit' }).click();`,
    pageState: expect.stringContaining(`- button "Submit"`),
  });

  const sessionFolder = extractSessionFolder(stderr());
  await expect
    .poll(() => readSessionLog(sessionFolder))
    .toBe(`
### Tool call: browser_navigate
- Args
\`\`\`json
{
  "url": "http://localhost:${server.PORT}/"
}
\`\`\`
- Code
\`\`\`js
await page.goto('http://localhost:${server.PORT}/');
\`\`\`
- Snapshot: 001.snapshot.yml


### Tool call: browser_click
- Args
\`\`\`json
{
  "element": "Submit button",
  "ref": "e2"
}
\`\`\`
- Code
\`\`\`js
await page.getByRole('button', { name: 'Submit' }).click();
\`\`\`
- Snapshot: 002.snapshot.yml

`);
});

test('session log should record user action', async ({
  cdpServer,
  startClient,
}, testInfo) => {
  const browserContext = await cdpServer.start();
  const { client, stderr } = await startClient({
    args: [
      '--save-session',
      '--output-dir',
      testInfo.outputPath('output'),
      `--cdp-endpoint=${cdpServer.endpoint}`,
    ],
  });

  // Force browser context creation.
  await client.callTool({
    name: 'browser_snapshot',
  });

  const [page] = browserContext.pages();
  await page.setContent(`
    <button>Button 1</button>
    <button>Button 2</button>
  `);

  await page.getByRole('button', { name: 'Button 1' }).click();

  const sessionFolder = extractSessionFolder(stderr());

  await expect
    .poll(() => readSessionLog(sessionFolder))
    .toBe(`
### Tool call: browser_snapshot
- Args
\`\`\`json
{}
\`\`\`
- Snapshot: 001.snapshot.yml


### User action: click
- Args
\`\`\`json
{
  "name": "click",
  "ref": "e2",
  "button": "left",
  "modifiers": 0,
  "clickCount": 1
}
\`\`\`
- Code
\`\`\`js
await page.getByRole('button', { name: 'Button 1' }).click();
\`\`\`
- Snapshot: 002.snapshot.yml

`);
});

test('session log should update user action', async ({
  cdpServer,
  startClient,
}, testInfo) => {
  const browserContext = await cdpServer.start();
  const { client, stderr } = await startClient({
    args: [
      '--save-session',
      '--output-dir',
      testInfo.outputPath('output'),
      `--cdp-endpoint=${cdpServer.endpoint}`,
    ],
  });

  // Force browser context creation.
  await client.callTool({
    name: 'browser_snapshot',
  });

  const [page] = browserContext.pages();
  await page.setContent(`
    <button>Button 1</button>
    <button>Button 2</button>
  `);

  await page.getByRole('button', { name: 'Button 1' }).dblclick();

  const sessionFolder = extractSessionFolder(stderr());

  await expect
    .poll(() => readSessionLog(sessionFolder))
    .toBe(`
### Tool call: browser_snapshot
- Args
\`\`\`json
{}
\`\`\`
- Snapshot: 001.snapshot.yml


### User action: click
- Args
\`\`\`json
{
  "name": "click",
  "ref": "e2",
  "button": "left",
  "modifiers": 0,
  "clickCount": 2
}
\`\`\`
- Code
\`\`\`js
await page.getByRole('button', { name: 'Button 1' }).dblclick();
\`\`\`
- Snapshot: 002.snapshot.yml

`);
});

test('session log should record tool calls and user actions', async ({
  cdpServer,
  startClient,
}, testInfo) => {
  const browserContext = await cdpServer.start();
  const { client, stderr } = await startClient({
    args: [
      '--save-session',
      '--output-dir',
      testInfo.outputPath('output'),
      `--cdp-endpoint=${cdpServer.endpoint}`,
    ],
  });

  const [page] = browserContext.pages();
  await page.setContent(`
    <button>Button 1</button>
    <button>Button 2</button>
  `);

  await client.callTool({
    name: 'browser_snapshot',
  });

  // Manual action.
  await page.getByRole('button', { name: 'Button 1' }).click();

  // This is to simulate a delay after the user action before the tool action.
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Tool action.
  await client.callTool({
    name: 'browser_click',
    arguments: {
      element: 'Button 2',
      ref: 'e3',
    },
  });

  const sessionFolder = extractSessionFolder(stderr());
  await expect
    .poll(() => readSessionLog(sessionFolder))
    .toBe(`
### Tool call: browser_snapshot
- Args
\`\`\`json
{}
\`\`\`
- Snapshot: 001.snapshot.yml


### User action: click
- Args
\`\`\`json
{
  "name": "click",
  "ref": "e2",
  "button": "left",
  "modifiers": 0,
  "clickCount": 1
}
\`\`\`
- Code
\`\`\`js
await page.getByRole('button', { name: 'Button 1' }).click();
\`\`\`
- Snapshot: 002.snapshot.yml


### Tool call: browser_click
- Args
\`\`\`json
{
  "element": "Button 2",
  "ref": "e3"
}
\`\`\`
- Code
\`\`\`js
await page.getByRole('button', { name: 'Button 2' }).click();
\`\`\`
- Snapshot: 003.snapshot.yml

`);
});
