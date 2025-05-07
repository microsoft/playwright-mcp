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

test('browser_take_screenshot (viewport)', async ({ client }) => {
  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: {
      url: 'data:text/html,<html><title>Title</title><body>Hello, world!</body></html>',
    },
  })).toContainTextContent(`Navigate to data:text/html`);

  expect(await client.callTool({
    name: 'browser_take_screenshot',
    arguments: {},
  })).toEqual({
    content: [
      {
        data: expect.any(String),
        mimeType: 'image/jpeg',
        type: 'image',
      },
      {
        text: expect.stringContaining(`Screenshot viewport and save it as`),
        type: 'text',
      },
    ],
  });
});

test('browser_take_screenshot (element)', async ({ client }) => {
  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: {
      url: 'data:text/html,<html><title>Title</title><button>Hello, world!</button></html>',
    },
  })).toContainTextContent(`[ref=s1e3]`);

  expect(await client.callTool({
    name: 'browser_take_screenshot',
    arguments: {
      element: 'hello button',
      ref: 's1e3',
    },
  })).toEqual({
    content: [
      {
        data: expect.any(String),
        mimeType: 'image/jpeg',
        type: 'image',
      },
      {
        text: expect.stringContaining(`page.getByRole('button', { name: 'Hello, world!' }).screenshot`),
        type: 'text',
      },
    ],
  });
});

test('--output-dir should work', async ({ startClient }, testInfo) => {
  const outputDir = testInfo.outputPath('output');
  const client = await startClient({
    args: ['--output-dir', outputDir],
  });
  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: {
      url: 'data:text/html,<html><title>Title</title><body>Hello, world!</body></html>',
    },
  })).toContainTextContent(`Navigate to data:text/html`);

  await client.callTool({
    name: 'browser_take_screenshot',
    arguments: {},
  });

  expect(fs.existsSync(outputDir)).toBeTruthy();
  expect([...fs.readdirSync(outputDir)]).toHaveLength(1);
});


test('browser_take_screenshot (outputDir)', async ({ startClient }, testInfo) => {
  const outputDir = testInfo.outputPath('output');
  const client = await startClient({
    config: { outputDir },
  });
  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: {
      url: 'data:text/html,<html><title>Title</title><body>Hello, world!</body></html>',
    },
  })).toContainTextContent(`Navigate to data:text/html`);

  await client.callTool({
    name: 'browser_take_screenshot',
    arguments: {},
  });

  expect(fs.existsSync(outputDir)).toBeTruthy();
  expect([...fs.readdirSync(outputDir)]).toHaveLength(1);
});

test('browser_take_screenshot (noImageResponses)', async ({ startClient }) => {
  const client = await startClient({
    config: {
      noImageResponses: true,
    },
  });

  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: {
      url: 'data:text/html,<html><title>Title</title><body>Hello, world!</body></html>',
    },
  })).toContainTextContent(`Navigate to data:text/html`);

  await client.callTool({
    name: 'browser_take_screenshot',
    arguments: {},
  });

  expect(await client.callTool({
    name: 'browser_take_screenshot',
    arguments: {},
  })).toEqual({
    content: [
      {
        text: expect.stringContaining(`Screenshot viewport and save it as`),
        type: 'text',
      },
    ],
  });
});

test('browser_take_screenshot (cursor)', async ({ startClient }) => {
  const client = await startClient({ clientName: 'cursor:vscode' });

  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: {
      url: 'data:text/html,<html><title>Title</title><body>Hello, world!</body></html>',
    },
  })).toContainTextContent(`Navigate to data:text/html`);

  await client.callTool({
    name: 'browser_take_screenshot',
    arguments: {},
  });

  expect(await client.callTool({
    name: 'browser_take_screenshot',
    arguments: {},
  })).toEqual({
    content: [
      {
        text: expect.stringContaining(`Screenshot viewport and save it as`),
        type: 'text',
      },
    ],
  });
});
