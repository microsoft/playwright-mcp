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

import { chromium } from 'playwright';

import { test, expect } from './fixtures.js';

import type { Client } from '@modelcontextprotocol/sdk/client/index.js';

async function createTab(client: Client, title: string, body: string) {
  return await client.callTool({
    name: 'browser_tab_new',
    arguments: {
      url: `data:text/html,<title>${title}</title><body>${body}</body>`,
    },
  });
}

test('list initial tabs', async ({ client }) => {
  expect(await client.callTool({
    name: 'browser_tab_list',
    arguments: {},
  })).toHaveTextContent(`### Open tabs
- 1: (current) [] (about:blank)`);
});

test('list first tab', async ({ client }) => {
  await createTab(client, 'Tab one', 'Body one');
  expect(await client.callTool({
    name: 'browser_tab_list',
    arguments: {},
  })).toHaveTextContent(`### Open tabs
- 1: [] (about:blank)
- 2: (current) [Tab one] (data:text/html,<title>Tab one</title><body>Body one</body>)`);
});

test('create new tab', async ({ client }) => {
  expect(await createTab(client, 'Tab one', 'Body one')).toHaveTextContent(`
- Ran Playwright code:
\`\`\`js
// <internal code to open a new tab>
\`\`\`

### Open tabs
- 1: [] (about:blank)
- 2: (current) [Tab one] (data:text/html,<title>Tab one</title><body>Body one</body>)

### Current tab
- Page URL: data:text/html,<title>Tab one</title><body>Body one</body>
- Page Title: Tab one
- Page Snapshot
\`\`\`yaml
- generic [ref=s1e2]: Body one
\`\`\``);

  expect(await createTab(client, 'Tab two', 'Body two')).toHaveTextContent(`
- Ran Playwright code:
\`\`\`js
// <internal code to open a new tab>
\`\`\`

### Open tabs
- 1: [] (about:blank)
- 2: [Tab one] (data:text/html,<title>Tab one</title><body>Body one</body>)
- 3: (current) [Tab two] (data:text/html,<title>Tab two</title><body>Body two</body>)

### Current tab
- Page URL: data:text/html,<title>Tab two</title><body>Body two</body>
- Page Title: Tab two
- Page Snapshot
\`\`\`yaml
- generic [ref=s1e2]: Body two
\`\`\``);
});

test('select tab', async ({ client }) => {
  await createTab(client, 'Tab one', 'Body one');
  await createTab(client, 'Tab two', 'Body two');
  expect(await client.callTool({
    name: 'browser_tab_select',
    arguments: {
      index: 2,
    },
  })).toHaveTextContent(`
- Ran Playwright code:
\`\`\`js
// <internal code to select tab 2>
\`\`\`

### Open tabs
- 1: [] (about:blank)
- 2: (current) [Tab one] (data:text/html,<title>Tab one</title><body>Body one</body>)
- 3: [Tab two] (data:text/html,<title>Tab two</title><body>Body two</body>)

### Current tab
- Page URL: data:text/html,<title>Tab one</title><body>Body one</body>
- Page Title: Tab one
- Page Snapshot
\`\`\`yaml
- generic [ref=s2e2]: Body one
\`\`\``);
});

test('close tab', async ({ client }) => {
  await createTab(client, 'Tab one', 'Body one');
  await createTab(client, 'Tab two', 'Body two');
  expect(await client.callTool({
    name: 'browser_tab_close',
    arguments: {
      index: 3,
    },
  })).toHaveTextContent(`
- Ran Playwright code:
\`\`\`js
// <internal code to close tab 3>
\`\`\`

### Open tabs
- 1: [] (about:blank)
- 2: (current) [Tab one] (data:text/html,<title>Tab one</title><body>Body one</body>)

### Current tab
- Page URL: data:text/html,<title>Tab one</title><body>Body one</body>
- Page Title: Tab one
- Page Snapshot
\`\`\`yaml
- generic [ref=s2e2]: Body one
\`\`\``);
});

test('reuse first tab when navigating', async ({ startClient, cdpEndpoint }) => {
  const browser = await chromium.connectOverCDP(await cdpEndpoint());
  const [context] = browser.contexts();
  const pages = context.pages();

  const client = await startClient({ args: [`--cdp-endpoint=${await cdpEndpoint()}`] });
  await client.callTool({
    name: 'browser_navigate',
    arguments: {
      url: 'data:text/html,<title>Title</title><body>Body</body>',
    },
  });

  expect(pages.length).toBe(1);
  expect(await pages[0].title()).toBe('Title');
});
