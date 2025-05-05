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

import url from 'node:url';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { test, expect } from './fixtures.js';

test.skip(({ mcpExtension }) => !!mcpExtension, 'Connecting to CDP server is not supported in combination with --extension');

test('cdp server', async ({ cdpEndpoint, startClient }) => {
  const client = await startClient({ args: [`--cdp-endpoint=${await cdpEndpoint()}`] });
  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: {
      url: 'data:text/html,<html><title>Title</title><body>Hello, world!</body></html>',
    },
  })).toContainTextContent(`- generic [ref=s1e2]: Hello, world!`);
});

test('cdp server reuse tab', async ({ cdpEndpoint, startClient }) => {
  const client = await startClient({ args: [`--cdp-endpoint=${await cdpEndpoint()}`] });

  expect(await client.callTool({
    name: 'browser_click',
    arguments: {
      element: 'Hello, world!',
      ref: 'f0',
    },
  })).toHaveTextContent(`Error: No current snapshot available. Capture a snapshot of navigate to a new location first.`);

  expect(await client.callTool({
    name: 'browser_snapshot',
    arguments: {},
  })).toHaveTextContent(`
- Ran Playwright code:
\`\`\`js
// <internal code to capture accessibility snapshot>
\`\`\`

- Page URL: data:text/html,hello world
- Page Title: 
- Page Snapshot
\`\`\`yaml
- generic [ref=s1e2]: hello world
\`\`\`
`);
});

test('should throw connection error and allow re-connecting', async ({ cdpEndpoint, startClient }) => {
  const port = 3200 + test.info().parallelIndex;
  const client = await startClient({ args: [`--cdp-endpoint=http://localhost:${port}`] });
  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: {
      url: 'data:text/html,<html><title>Title</title><body>Hello, world!</body></html>',
    },
  })).toContainTextContent(`Error: browserType.connectOverCDP: connect ECONNREFUSED`);
  await cdpEndpoint(port);
  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: {
      url: 'data:text/html,<html><title>Title</title><body>Hello, world!</body></html>',
    },
  })).toContainTextContent(`- generic [ref=s1e2]: Hello, world!`);
});

// NOTE: Can be removed when we drop Node.js 18 support and changed to import.meta.filename.
const __filename = url.fileURLToPath(import.meta.url);

test('does not support --device', async () => {
  const result = spawnSync('node', [
    path.join(__filename, '../../cli.js'), '--device=Pixel 5', '--cdp-endpoint=http://localhost:1234',
  ]);
  expect(result.error).toBeUndefined();
  expect(result.status).toBe(1);
  expect(result.stderr.toString()).toContain('Device emulation is not supported with cdpEndpoint.');
});
