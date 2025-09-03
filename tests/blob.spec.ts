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

import { test, expect } from './fixtures';

test('browser_save_blob with text blob', async ({ startClient, server }, testInfo) => {
  const outputDir = testInfo.outputPath('output');
  const { client } = await startClient({
    config: { outputDir },
  });

  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  })).toHaveResponse({
    pageState: expect.stringContaining(`- generic [active] [ref=e1]: Hello, world!`),
  });

  // Create a text blob with known content and get its URL
  const blobResult = await client.callTool({
    name: 'browser_evaluate',
    arguments: {
      function: `() => {
        const content = "Hello, this is test content for blob saving!";
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        
        // Store the blob globally so it can be accessed later
        window.testBlob = blob;
        window.testBlobUrl = url;
        
        return url;
      }`,
    },
  });

  // Extract the actual blob URL from the formatted response
  const responseText = blobResult.content[0].text;
  const blobUrlMatch = responseText.match(/"(blob:http[^"]+)"/);
  if (!blobUrlMatch) {
    throw new Error(`Could not extract blob URL from response: ${responseText}`);
  }
  const blobUrl = blobUrlMatch[1];

  // Test saving the blob
  expect(await client.callTool({
    name: 'browser_save_blob',
    arguments: {
      blobUrl,
      filename: 'test.txt',
    },
  })).toHaveResponse({
    result: expect.stringContaining('test.txt'),
  });

  // Verify file was created
  const files = [...fs.readdirSync(outputDir)];
  const txtFiles = files.filter(f => f.endsWith('.txt'));
  expect(txtFiles).toHaveLength(1);
  expect(txtFiles[0]).toMatch(/^test\.txt$/);

  // Verify file content
  const savedContent = fs.readFileSync(`${outputDir}/test.txt`, 'utf8');
  expect(savedContent).toBe('Hello, this is test content for blob saving!');
});

test('browser_save_blob auto-detection with iframe', async ({ startClient, server }, testInfo) => {
  const outputDir = testInfo.outputPath('output');
  const { client } = await startClient({
    config: { outputDir },
  });

  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  })).toHaveResponse({
    pageState: expect.stringContaining(`- generic [active] [ref=e1]: Hello, world!`),
  });

  // Create a blob URL and add it to an iframe
  await client.callTool({
    name: 'browser_evaluate',
    arguments: {
      function: `() => {
        const content = "Auto-detected blob content!";
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        
        // Create an iframe with the blob URL
        const iframe = document.createElement('iframe');
        iframe.src = url;
        document.body.appendChild(iframe);
        
        return url;
      }`,
    },
  });

  // Test auto-detection (no blobUrl specified)
  expect(await client.callTool({
    name: 'browser_save_blob',
    arguments: {
      filename: 'auto-detected.txt',
    },
  })).toHaveResponse({
    result: expect.stringContaining('auto-detected.txt'),
  });

  // Verify file was created
  const files = [...fs.readdirSync(outputDir)];
  const txtFiles = files.filter(f => f.endsWith('.txt'));
  expect(txtFiles).toHaveLength(1);
  expect(txtFiles[0]).toMatch(/^auto-detected\.txt$/);

  // Verify file content
  const savedContent = fs.readFileSync(`${outputDir}/auto-detected.txt`, 'utf8');
  expect(savedContent).toBe('Auto-detected blob content!');
});

test('browser_save_blob error when no blob URL found', async ({ startClient, server }) => {
  const { client } = await startClient();

  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  })).toHaveResponse({
    pageState: expect.stringContaining(`Hello, world!`),
  });

  expect(await client.callTool({
    name: 'browser_save_blob',
  })).toHaveResponse({
    result: 'Error: No blob URL found. Please provide a blob URL or navigate to a page with blob content.',
    isError: true,
  });
});

test('browser_save_blob error with non-blob URL', async ({ startClient, server }) => {
  const { client } = await startClient();

  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  })).toHaveResponse({
    pageState: expect.stringContaining(`Hello, world!`),
  });

  expect(await client.callTool({
    name: 'browser_save_blob',
    arguments: {
      blobUrl: 'https://example.com/file.pdf',
    },
  })).toHaveResponse({
    result: 'Error: Provided URL is not a blob URL. Only blob: URLs are supported.',
    isError: true,
  });
});