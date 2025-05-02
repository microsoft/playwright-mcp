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
import path from 'path';

test('browser_file_upload', async ({ client }) => {
  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: {
      url: 'data:text/html,<html><title>Title</title><input type="file" /><button>Button</button></html>',
    },
  })).toContainTextContent(`
\`\`\`yaml
- button "Choose File" [ref=s1e3]
- button "Button" [ref=s1e4]
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
      ref: 's1e3',
    },
  })).toContainTextContent(`### Modal state
- [File chooser]: can be handled by the "browser_file_upload" tool`);

  const filePath = test.info().outputPath('test.txt');
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
- button "Choose File" [ref=s3e3]
- button "Button" [ref=s3e4]
\`\`\``);
  }

  {
    const response = await client.callTool({
      name: 'browser_click',
      arguments: {
        element: 'Textbox',
        ref: 's3e3',
      },
    });

    expect(response).toContainTextContent('- [File chooser]: can be handled by the \"browser_file_upload\" tool');
  }

  {
    const response = await client.callTool({
      name: 'browser_click',
      arguments: {
        element: 'Button',
        ref: 's4e4',
      },
    });

    expect(response).toContainTextContent(`Tool "browser_click" does not handle the modal state.
### Modal state
- [File chooser]: can be handled by the "browser_file_upload" tool`);
  }
});

test('clicking on download link emits download', async ({ startClient }, testInfo) => {
  const outputDir = testInfo.outputPath('output');
  const client = await startClient({
    config: { outputDir },
  });

  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: {
      url: 'data:text/html,<a href="data:text/plain,Hello world!" download="test.txt">Download</a>',
    },
  })).toContainTextContent('- link "Download" [ref=s1e3]');
  await client.callTool({
    name: 'browser_click',
    arguments: {
      element: 'Download link',
      ref: 's1e3',
    },
  });
  await expect.poll(() => client.callTool({ name: 'browser_snapshot', arguments: {} })).toContainTextContent(`
### Downloads
- Downloaded file test.txt to ${path.join(outputDir, 'test.txt')}`);
});
