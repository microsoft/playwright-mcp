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
import fs from 'fs/promises';

test('browser_file_upload', async ({ client, server }, testInfo) => {
  server.setContent('/', `
    <input type="file" />
    <button>Button</button>
  `, 'text/html');

  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  })).toContainTextContent(`
\`\`\`yaml
- generic [ref=e1]:
  - button "Choose File" [ref=e2]
  - button "Button" [ref=e3]
\`\`\``);

  {
    expect(await client.callTool({
      name: 'browser_file_upload',
      arguments: { paths: [] },
    })).toHaveTextContent(`
The tool "browser_file_upload" can only be used when there is related modal state present.
### Modal state
- There is no modal state present
      `.trim());
  }

  expect(await client.callTool({
    name: 'browser_click',
    arguments: {
      element: 'Textbox',
      ref: 'e2',
    },
  })).toContainTextContent(`### Modal state
- [File chooser]: can be handled by the "browser_file_upload" tool`);

  const filePath = testInfo.outputPath('test.txt');
  await fs.writeFile(filePath, 'Hello, world!');

  {
    const response = await client.callTool({
      name: 'browser_file_upload',
      arguments: {
        paths: [filePath],
      },
    });

    expect(response).not.toContainTextContent('### Modal state');
    expect(response).toContainTextContent(`
\`\`\`yaml
- generic [ref=e1]:
  - button "Choose File" [ref=e2]
  - button "Button" [ref=e3]
\`\`\``);
  }

  {
    const response = await client.callTool({
      name: 'browser_click',
      arguments: {
        element: 'Textbox',
        ref: 'e2',
      },
    });

    expect(response).toContainTextContent('- [File chooser]: can be handled by the \"browser_file_upload\" tool');
  }

  {
    const response = await client.callTool({
      name: 'browser_click',
      arguments: {
        element: 'Button',
        ref: 'e3',
      },
    });

    expect(response).toContainTextContent(`Tool "browser_click" does not handle the modal state.
### Modal state
- [File chooser]: can be handled by the "browser_file_upload" tool`);
  }
});

test('clicking on download link emits download', async ({ startClient, server, mcpMode }, testInfo) => {
  test.fixme(mcpMode === 'extension', 'Downloads are on the Browser CDP domain and not supported with --extension');
  const { client } = await startClient({
    config: { outputDir: testInfo.outputPath('output') },
  });

  server.setContent('/', `<a href="/download" download="test.txt">Download</a>`, 'text/html');
  server.setContent('/download', 'Data', 'text/plain');

  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  })).toContainTextContent('- link "Download" [ref=e2]');
  await client.callTool({
    name: 'browser_click',
    arguments: {
      element: 'Download link',
      ref: 'e2',
    },
  });
  await expect.poll(() => client.callTool({ name: 'browser_snapshot' })).toContainTextContent(`
### Downloads
- Downloaded file test.txt to ${testInfo.outputPath('output', 'test.txt')}`);
});

test('navigating to download link emits download', async ({ startClient, server, mcpBrowser, mcpMode }, testInfo) => {
  test.fixme(mcpMode === 'extension', 'Downloads are on the Browser CDP domain and not supported with --extension');
  const { client } = await startClient({
    config: { outputDir: testInfo.outputPath('output') },
  });

  test.skip(mcpBrowser === 'webkit' && process.platform === 'linux', 'https://github.com/microsoft/playwright/blob/8e08fdb52c27bb75de9bf87627bf740fadab2122/tests/library/download.spec.ts#L436');
  server.route('/download', (req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/plain',
      'Content-Disposition': 'attachment; filename=test.txt',
    });
    res.end('Hello world!');
  });

  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: {
      url: server.PREFIX + 'download',
    },
  })).toContainTextContent('### Downloads');
});
