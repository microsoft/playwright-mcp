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

test('browser_take_screenshot (viewport)', async ({ startClient, server }, testInfo) => {
  const { client } = await startClient({
    config: { outputDir: testInfo.outputPath('output') },
  });
  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  })).toContainTextContent(`Navigate to http://localhost`);

  expect(await client.callTool({
    name: 'browser_take_screenshot',
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

test('browser_take_screenshot (element)', async ({ startClient, server }, testInfo) => {
  const { client } = await startClient({
    config: { outputDir: testInfo.outputPath('output') },
  });
  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  })).toContainTextContent(`[ref=e1]`);

  expect(await client.callTool({
    name: 'browser_take_screenshot',
    arguments: {
      element: 'hello button',
      ref: 'e1',
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

test('--output-dir should work', async ({ startClient, server }, testInfo) => {
  const outputDir = testInfo.outputPath('output');
  const { client } = await startClient({
    config: { outputDir },
  });
  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  })).toContainTextContent(`Navigate to http://localhost`);

  await client.callTool({
    name: 'browser_take_screenshot',
  });

  expect(fs.existsSync(outputDir)).toBeTruthy();
  const files = [...fs.readdirSync(outputDir)].filter(f => f.endsWith('.jpeg'));
  expect(files).toHaveLength(1);
  expect(files[0]).toMatch(/^page-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.jpeg$/);
});

for (const raw of [undefined, true]) {
  test(`browser_take_screenshot (raw: ${raw})`, async ({ startClient, server }, testInfo) => {
    const outputDir = testInfo.outputPath('output');
    const ext = raw ? 'png' : 'jpeg';
    const { client } = await startClient({
      config: { outputDir },
    });
    expect(await client.callTool({
      name: 'browser_navigate',
      arguments: { url: server.PREFIX },
    })).toContainTextContent(`Navigate to http://localhost`);

    expect(await client.callTool({
      name: 'browser_take_screenshot',
      arguments: { raw },
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

test('browser_take_screenshot (filename: "output.jpeg")', async ({ startClient, server }, testInfo) => {
  const outputDir = testInfo.outputPath('output');
  const { client } = await startClient({
    config: { outputDir },
  });
  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  })).toContainTextContent(`Navigate to http://localhost`);

  expect(await client.callTool({
    name: 'browser_take_screenshot',
    arguments: {
      filename: 'output.jpeg',
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

test('browser_take_screenshot (imageResponses=omit)', async ({ startClient, server }, testInfo) => {
  const outputDir = testInfo.outputPath('output');
  const { client } = await startClient({
    config: {
      outputDir,
      imageResponses: 'omit',
    },
  });

  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  })).toContainTextContent(`Navigate to http://localhost`);

  await client.callTool({
    name: 'browser_take_screenshot',
  });

  expect(await client.callTool({
    name: 'browser_take_screenshot',
  })).toEqual({
    content: [
      {
        text: expect.stringContaining(`Screenshot viewport and save it as`),
        type: 'text',
      },
    ],
  });
});

test('browser_take_screenshot (cursor)', async ({ startClient, server }, testInfo) => {
  const outputDir = testInfo.outputPath('output');

  const { client } = await startClient({
    clientName: 'cursor:vscode',
    config: { outputDir },
  });

  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  })).toContainTextContent(`Navigate to http://localhost`);

  await client.callTool({
    name: 'browser_take_screenshot',
  });

  expect(await client.callTool({
    name: 'browser_take_screenshot',
  })).toEqual({
    content: [
      {
        text: expect.stringContaining(`Screenshot viewport and save it as`),
        type: 'text',
      },
    ],
  });
});
