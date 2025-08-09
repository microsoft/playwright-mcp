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

import fs from 'node:fs';

import { expect, test } from './fixtures.js';
import { callTool, navigateToUrl } from './test-helpers.js';

// Screenshot test constants
const SCREENSHOT_PATTERNS = {
  FILENAME_VALIDATION:
    /page-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.(png|jpeg)/,
  PAGE_TIMESTAMP: /^page-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.png$/,
  PAGE_TIMESTAMP_MATCH: /page-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.png/,
  OUTPUT_PNG: /^output\.png$/,
} as const;

// Common expectation objects for screenshot tests
const COMMON_EXPECTATIONS = {
  WITH_CODE: { includeCode: true },
  MINIMAL: {
    includeSnapshot: false,
    includeConsole: false,
    includeDownloads: false,
    includeTabs: false,
    includeCode: false,
  },
} as const;

// Common assertion patterns
function expectImageAttachment(mimeType = 'image/png') {
  return {
    data: expect.any(String),
    mimeType,
    type: 'image',
  };
}

function expectScreenshotContent(text?: string, mimeType = 'image/png') {
  const content: Array<{
    text?: unknown;
    type: string;
    data?: string;
    mimeType?: string;
  }> = [];
  if (text) {
    content.push({
      text: expect.stringContaining(text),
      type: 'text',
    });
  }
  content.push(expectImageAttachment(mimeType));
  return { content };
}

// File verification helpers
function verifyScreenshotFiles(
  outputDir: string,
  expectedCount = 1,
  fileExtension = 'png',
  pattern?: RegExp
): void {
  expect(fs.existsSync(outputDir)).toBeTruthy();
  const files = fs
    .readdirSync(outputDir)
    .filter((f) => f.endsWith(`.${fileExtension}`));
  expect(files).toHaveLength(expectedCount);
  if (pattern && files.length > 0) {
    expect(files[0]).toMatch(pattern);
  }
}

// Common test setup
function createScreenshotTestSetup(testInfo: any) {
  return {
    outputDir: testInfo.outputPath('output'),
    clientConfig: { outputDir: testInfo.outputPath('output') },
  };
}

test('browser_take_screenshot (viewport)', async ({
  startClient,
  server,
}, testInfo) => {
  const { clientConfig } = createScreenshotTestSetup(testInfo);
  const { client } = await startClient({ config: clientConfig });

  expect(await navigateToUrl(client, server.HELLO_WORLD)).toHaveResponse({
    code: expect.stringContaining(`page.goto('http://localhost`),
  });

  expect(
    await callTool(client, 'browser_take_screenshot', {
      expectation: COMMON_EXPECTATIONS.WITH_CODE,
    })
  ).toHaveResponse({
    code: expect.stringContaining('await page.screenshot'),
    attachments: [expectImageAttachment()],
  });
});

test('browser_take_screenshot (element)', async ({
  startClient,
  server,
}, testInfo) => {
  const { clientConfig } = createScreenshotTestSetup(testInfo);
  const { client } = await startClient({ config: clientConfig });

  expect(await navigateToUrl(client, server.HELLO_WORLD)).toHaveResponse({
    pageState: expect.stringContaining('[ref=e1]'),
  });

  expect(
    await callTool(client, 'browser_take_screenshot', {
      element: 'hello button',
      ref: 'e1',
      expectation: COMMON_EXPECTATIONS.WITH_CODE,
    })
  ).toEqual(
    expectScreenshotContent(`page.getByText('Hello, world!').screenshot`)
  );
});

test('--output-dir should work', async ({ startClient, server }, testInfo) => {
  const { outputDir, clientConfig } = createScreenshotTestSetup(testInfo);
  const { client } = await startClient({ config: clientConfig });

  expect(await navigateToUrl(client, server.HELLO_WORLD)).toHaveResponse({
    code: expect.stringContaining(`page.goto('http://localhost`),
  });

  await callTool(client, 'browser_take_screenshot', {});

  verifyScreenshotFiles(
    outputDir,
    1,
    'png',
    SCREENSHOT_PATTERNS.PAGE_TIMESTAMP
  );
});

for (const type of ['png', 'jpeg']) {
  test(`browser_take_screenshot (type: ${type})`, async ({
    startClient,
    server,
  }, testInfo) => {
    const { outputDir, clientConfig } = createScreenshotTestSetup(testInfo);
    const { client } = await startClient({ config: clientConfig });

    expect(await navigateToUrl(client, server.PREFIX)).toHaveResponse({
      code: expect.stringContaining(`page.goto('http://localhost`),
    });

    expect(await callTool(client, 'browser_take_screenshot', { type })).toEqual(
      {
        content: [
          {
            text: expect.stringMatching(
              SCREENSHOT_PATTERNS.FILENAME_VALIDATION
            ),
            type: 'text',
          },
          expectImageAttachment(`image/${type}`),
        ],
      }
    );

    const filePattern = new RegExp(
      `^page-\\d{4}-\\d{2}-\\d{2}T\\d{2}-\\d{2}-\\d{2}-\\d{3}Z\\.${type}$`
    );
    verifyScreenshotFiles(outputDir, 1, type, filePattern);
  });
}

test('browser_take_screenshot (default type should be png)', async ({
  startClient,
  server,
}, testInfo) => {
  const { outputDir, clientConfig } = createScreenshotTestSetup(testInfo);
  const { client } = await startClient({ config: clientConfig });

  expect(await navigateToUrl(client, server.PREFIX)).toHaveResponse({
    code: `await page.goto('${server.PREFIX}');`,
  });

  expect(await callTool(client, 'browser_take_screenshot', {})).toEqual({
    content: [
      {
        text: expect.stringMatching(SCREENSHOT_PATTERNS.PAGE_TIMESTAMP_MATCH),
        type: 'text',
      },
      expectImageAttachment(),
    ],
  });

  verifyScreenshotFiles(
    outputDir,
    1,
    'png',
    SCREENSHOT_PATTERNS.PAGE_TIMESTAMP
  );
});

test('browser_take_screenshot (filename: "output.png")', async ({
  startClient,
  server,
}, testInfo) => {
  const { outputDir, clientConfig } = createScreenshotTestSetup(testInfo);
  const { client } = await startClient({ config: clientConfig });

  expect(await navigateToUrl(client, server.HELLO_WORLD)).toHaveResponse({
    code: expect.stringContaining(`page.goto('http://localhost`),
  });

  expect(
    await callTool(client, 'browser_take_screenshot', {
      filename: 'output.png',
    })
  ).toEqual(expectScreenshotContent('output.png'));

  verifyScreenshotFiles(outputDir, 1, 'png', SCREENSHOT_PATTERNS.OUTPUT_PNG);
});

test('browser_take_screenshot (imageResponses=omit)', async ({
  startClient,
  server,
}, testInfo) => {
  const outputDir = testInfo.outputPath('output');
  const { client } = await startClient({
    config: {
      outputDir,
      imageResponses: 'omit',
    },
  });

  expect(await navigateToUrl(client, server.HELLO_WORLD)).toHaveResponse({
    code: expect.stringContaining(`page.goto('http://localhost`),
  });

  await callTool(client, 'browser_take_screenshot', {});

  expect(
    await callTool(client, 'browser_take_screenshot', {
      expectation: COMMON_EXPECTATIONS.WITH_CODE,
    })
  ).toEqual({
    content: [
      {
        text: expect.stringContaining('await page.screenshot'),
        type: 'text',
      },
    ],
  });
});

test('browser_take_screenshot (fullPage: true)', async ({
  startClient,
  server,
}, testInfo) => {
  const { clientConfig } = createScreenshotTestSetup(testInfo);
  const { client } = await startClient({ config: clientConfig });

  expect(await navigateToUrl(client, server.HELLO_WORLD)).toHaveResponse({
    code: expect.stringContaining(`page.goto('http://localhost`),
  });

  expect(
    await callTool(client, 'browser_take_screenshot', {
      fullPage: true,
      expectation: COMMON_EXPECTATIONS.WITH_CODE,
    })
  ).toEqual(expectScreenshotContent('fullPage: true'));
});

test('browser_take_screenshot (fullPage with element should error)', async ({
  startClient,
  server,
}, testInfo) => {
  const { clientConfig } = createScreenshotTestSetup(testInfo);
  const { client } = await startClient({ config: clientConfig });

  expect(await navigateToUrl(client, server.HELLO_WORLD)).toHaveResponse({
    pageState: expect.stringContaining('[ref=e1]'),
  });

  const result = await callTool(client, 'browser_take_screenshot', {
    fullPage: true,
    element: 'hello button',
    ref: 'e1',
  });

  expect(result.isError).toBe(true);
  expect(result.content?.[0]?.text).toContain(
    'fullPage cannot be used with element screenshots'
  );
});

test('browser_take_screenshot (viewport without snapshot)', async ({
  startClient,
  server,
}, testInfo) => {
  const { clientConfig } = createScreenshotTestSetup(testInfo);
  const { client } = await startClient({ config: clientConfig });

  // Ensure we have a tab but don't navigate anywhere (no snapshot captured)
  expect(await callTool(client, 'browser_tab_list', {})).toHaveResponse({
    tabs: '- 0: (current) [] (about:blank)',
  });

  // This should work without requiring a snapshot since it's a viewport screenshot
  expect(
    await callTool(client, 'browser_take_screenshot', {
      expectation: COMMON_EXPECTATIONS.WITH_CODE,
    })
  ).toEqual(expectScreenshotContent('page.screenshot'));
});
