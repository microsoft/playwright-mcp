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

test('browser_take_screenshot (viewport)', async ({ startClient, server, localOutputPath }) => {
  const outputDir = localOutputPath('output');
  const client = await startClient({
    args: ['--output-dir', outputDir],
  });
  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: {
      url: server.HELLO_WORLD,
      intent: 'Navigate to the page',
    },
  })).toContainTextContent(`Navigate to the page`);

  expect(await client.callTool({
    name: 'browser_take_screenshot',
    arguments: {
      intent: 'Take screenshot of the page',
    },
  })).toEqual({
    content: [
      {
        data: expect.any(String),
        mimeType: 'image/jpeg',
        type: 'image',
      },
      {
        text: expect.stringContaining(`Take screenshot of the page`),
        type: 'text',
      },
    ],
  });
});

test('browser_take_screenshot (element)', async ({ startClient, server, localOutputPath }) => {
  const outputDir = localOutputPath('output');
  const client = await startClient({
    args: ['--output-dir', outputDir],
  });
  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD,
      intent: 'Navigate to the page',
    },
  })).toContainTextContent(`[ref=e1]`);

  expect(await client.callTool({
    name: 'browser_take_screenshot',
    arguments: {
      element: 'hello button',
      ref: 'e1',
      intent: 'Take screenshot of hello button',
    },
  })).toEqual({
    content: [
      {
        data: expect.any(String),
        mimeType: 'image/jpeg',
        type: 'image',
      },
      {
        text: expect.stringContaining(`page.getByText('Hello, world!').screenshot`),
        type: 'text',
      },
    ],
  });
});

test('--output-dir should work', async ({ startClient, localOutputPath, server }) => {
  const outputDir = localOutputPath('output');
  const client = await startClient({
    args: ['--output-dir', outputDir],
  });
  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: {
      url: server.HELLO_WORLD,
      intent: 'Navigate to the page',
    },
  })).toContainTextContent(`Navigate to the page`);

  await client.callTool({
    name: 'browser_take_screenshot',
  });

  expect(fs.existsSync(outputDir)).toBeTruthy();
  const files = [...fs.readdirSync(outputDir)].filter(f => f.endsWith('.jpeg'));
  expect(files).toHaveLength(1);
  expect(files[0]).toMatch(/^page-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.jpeg$/);
});

for (const raw of [undefined, true]) {
  test(`browser_take_screenshot (raw: ${raw})`, async ({ startClient, localOutputPath, server }) => {
    const ext = raw ? 'png' : 'jpeg';
    const outputDir = localOutputPath('output');
    const client = await startClient({
      config: { outputDir },
    });
    expect(await client.callTool({
      name: 'browser_navigate',
      arguments: {
        url: server.PREFIX,
        intent: 'Navigate to the page',
      },
    })).toContainTextContent(`Navigate to the page`);

    expect(await client.callTool({
      name: 'browser_take_screenshot',
      arguments: { raw,
        intent: 'Take screenshot of the page',
      },
    })).toEqual({
      content: [
        {
          data: expect.any(String),
          mimeType: `image/${ext}`,
          type: 'image',
        },
        {
          text: expect.stringMatching(
              new RegExp(`page-\\d{4}-\\d{2}-\\d{2}T\\d{2}-\\d{2}-\\d{2}\\-\\d{3}Z\\.${ext}`)
          ),
          type: 'text',
        },
      ],
    });

    const files = [...fs.readdirSync(outputDir)].filter(f => f.endsWith(`.${ext}`));

    expect(fs.existsSync(outputDir)).toBeTruthy();
    expect(files).toHaveLength(1);
    expect(files[0]).toMatch(
        new RegExp(`^page-\\d{4}-\\d{2}-\\d{2}T\\d{2}-\\d{2}-\\d{2}-\\d{3}Z\\.${ext}$`)
    );
  });

}

test('browser_take_screenshot (filename: "output.jpeg")', async ({ startClient, localOutputPath, server }) => {
  const outputDir = localOutputPath('output');
  const client = await startClient({
    config: { outputDir },
  });
  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: {
      url: server.HELLO_WORLD,
      intent: 'Navigate to the page',
    },
  })).toContainTextContent(`Navigate to the page`);

  expect(await client.callTool({
    name: 'browser_take_screenshot',
    arguments: {
      filename: 'output.jpeg',
      intent: 'Take screenshot of the page',
    },
  })).toEqual({
    content: [
      {
        data: expect.any(String),
        mimeType: 'image/jpeg',
        type: 'image',
      },
      {
        text: expect.stringContaining(`output.jpeg`),
        type: 'text',
      },
    ],
  });

  const files = [...fs.readdirSync(outputDir)].filter(f => f.endsWith('.jpeg'));

  expect(fs.existsSync(outputDir)).toBeTruthy();
  expect(files).toHaveLength(1);
  expect(files[0]).toMatch(/^output\.jpeg$/);
});

test('browser_take_screenshot (noImageResponses)', async ({ startClient, server, localOutputPath }) => {
  const client = await startClient({
    config: {
      outputDir: localOutputPath('output'),
      noImageResponses: true,
    },
  });

  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: {
      url: server.HELLO_WORLD,
      intent: 'Navigate to the page',
    },
  })).toContainTextContent(`Navigate to the page`);

  expect(await client.callTool({
    name: 'browser_take_screenshot',
    arguments: {
      intent: 'Take screenshot of the page',
    },
  })).toEqual({
    content: [
      {
        text: expect.stringContaining(`Take screenshot of the page`),
        type: 'text',
      },
    ],
  });
});

test('browser_take_screenshot (cursor)', async ({ startClient, server, localOutputPath }) => {
  const outputDir = localOutputPath('output');
  const client = await startClient({
    clientName: 'cursor:vscode',
    config: { outputDir },
  });

  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: {
      url: server.HELLO_WORLD,
      intent: 'Navigate to the page',
    },
  })).toContainTextContent(`Navigate to the page`);

  expect(await client.callTool({
    name: 'browser_take_screenshot',
    arguments: {
      intent: 'Take screenshot of the page',
    },
  })).toEqual({
    content: [
      {
        text: expect.stringContaining(`Take screenshot of the page`),
        type: 'text',
      },
    ],
  });
});
