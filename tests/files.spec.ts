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
import fs from 'fs/promises';

test('browser_file_upload', async ({ client }) => {
  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: {
      url: 'data:text/html,<html><title>Title</title><input type="file" /><button>Button</button></html>',
    },
  })).toContainTextContent('- textbox [ref=s1e3]');

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
    expect(response).toContainTextContent('textbox [ref=s3e3]: C:\\fakepath\\test.txt');
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

test.describe('browser_file_download', () => {
  test('after clicking on download link', async ({ client }) => {
    expect(await client.callTool({
      name: 'browser_navigate',
      arguments: {
        url: 'data:text/html,<a href="data:text/plain,Hello world!" download="test.txt">Download</a>',
      },
    })).toContainTextContent('- link "Download" [ref=s1e3]');

    expect(await client.callTool({
      name: 'browser_click',
      arguments: {
        element: 'Download link',
        ref: 's1e3',
      },
    })).toContainTextContent(`
### Modal state
- [Download (test.txt)]: can be handled by the "browser_file_download" tool`);

    expect(await client.callTool({
      name: 'browser_snapshot',
      arguments: {},
    })).toContainTextContent(`
Tool "browser_snapshot" does not handle the modal state.
### Modal state
- [Download (test.txt)]: can be handled by the "browser_file_download" tool`.trim());

    expect(await client.callTool({
      name: 'browser_file_download',
      arguments: {
        filenames: ['wrong_file.txt'],
      },
    })).toContainTextContent(`Error: No download modal visible for file wrong_file.txt`);

    expect(await client.callTool({
      name: 'browser_file_download',
      arguments: {
        filenames: ['test.txt'],
      },
    })).toContainTextContent([`Downloaded test.txt to`, '// <internal code to accept and cancel files>']);
  });

  test('navigating to downloading link', async ({ client, server }) => {
    server.on('request', (req, res) => {
      res.setHeader('Content-Disposition', 'attachment; filename="test.txt"');
      res.end('Hello world!');
    });
    expect(await client.callTool({
      name: 'browser_navigate',
      arguments: {
        url: server.PREFIX,
      },
    })).toContainTextContent('### Modal state\n- [Download (test.txt)]');
    expect(await client.callTool({
      name: 'browser_file_download',
      arguments: {
        filenames: ['test.txt'],
      },
    })).toContainTextContent([`Downloaded test.txt to`, '// <internal code to accept and cancel files>\n```\n\n- Page URL: about:blank']);
  });
});
