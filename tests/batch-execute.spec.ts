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

import { expect, test } from './fixtures.js';

// Top-level regex patterns for performance optimization
// Safe regex pattern to avoid ReDoS vulnerability - matches digits followed by 'ms'
const MILLISECONDS_REGEX = /\d{1,10}ms/u;

test.describe('Browser Batch Execute', () => {
  test('should execute multiple navigation and interaction steps in sequence', async ({
    client,
    server,
  }) => {
    // Setup test page with clickable button
    server.setContent(
      '/',
      `
      <title>Test Page</title>
      <button>Click Me</button>
    `,
      'text/html'
    );

    const result = await client.callTool({
      name: 'browser_batch_execute',
      arguments: {
        steps: [
          {
            tool: 'browser_navigate',
            arguments: { url: server.PREFIX },
            expectation: { includeSnapshot: true, includeConsole: false },
          },
          {
            tool: 'browser_click',
            arguments: { element: 'Click Me button', ref: 'e2' },
            expectation: { includeSnapshot: true, includeConsole: false },
          },
        ],
        stopOnFirstError: true,
        globalExpectation: { includeDownloads: false, includeTabs: false },
      },
    });

    expect(result.content[0].text).toContain('Batch Execution Summary');
    expect(result.content[0].text).toContain('✅ Completed');
    expect(result.content[0].text).toContain('Total Steps: 2');
    expect(result.content[0].text).toContain('Successful: 2');
    expect(result.content[0].text).toContain('Failed: 0');
    expect(result.content[0].text).toContain('Step Details');
    expect(result.content[0].text).toContain('✅ Step 1: browser_navigate');
    expect(result.content[0].text).toContain('✅ Step 2: browser_click');
  });

  test('should handle batch execution with individual step errors when continueOnError=true', async ({
    client,
    server,
  }) => {
    server.setContent(
      '/',
      `
      <title>Test Page</title>
      <button>Click Me</button>
    `,
      'text/html'
    );

    const result = await client.callTool({
      name: 'browser_batch_execute',
      arguments: {
        steps: [
          {
            tool: 'browser_navigate',
            arguments: { url: server.PREFIX },
            expectation: { includeSnapshot: false },
          },
          {
            tool: 'browser_click',
            arguments: { element: 'nonexistent button', ref: 'nonexistent' },
            continueOnError: true,
            expectation: { includeSnapshot: false },
          },
          {
            tool: 'browser_click',
            arguments: { element: 'Click Me button', ref: 'e2' },
            expectation: { includeSnapshot: true },
          },
        ],
        stopOnFirstError: false,
      },
    });

    expect(result.content[0].text).toContain('Batch Execution Summary');
    expect(result.content[0].text).toContain('Total Steps: 3');
    expect(result.content[0].text).toContain('Successful: 2');
    expect(result.content[0].text).toContain('Failed: 1');
    expect(result.content[0].text).toContain('✅ Step 1: browser_navigate');
    expect(result.content[0].text).toContain('❌ Step 2: browser_click');
    expect(result.content[0].text).toContain('✅ Step 3: browser_click');
  });

  test('should stop on first error when stopOnFirstError=true and step has continueOnError=false', async ({
    client,
    server,
  }) => {
    server.setContent(
      '/',
      `
      <title>Test Page</title>
      <button>Click Me</button>
    `,
      'text/html'
    );

    const result = await client.callTool({
      name: 'browser_batch_execute',
      arguments: {
        steps: [
          {
            tool: 'browser_navigate',
            arguments: { url: server.PREFIX },
            expectation: { includeSnapshot: false },
          },
          {
            tool: 'browser_click',
            arguments: { element: 'nonexistent button', ref: 'nonexistent' },
            continueOnError: false,
            expectation: { includeSnapshot: false },
          },
          {
            tool: 'browser_click',
            arguments: { element: 'Click Me button', ref: 'e2' },
            expectation: { includeSnapshot: false },
          },
        ],
        stopOnFirstError: true,
      },
    });

    expect(result.content[0].text).toContain('Batch Execution Summary');
    expect(result.content[0].text).toContain('❌ Stopped on Error');
    expect(result.content[0].text).toContain('Total Steps: 3');
    expect(result.content[0].text).toContain('Successful: 1');
    expect(result.content[0].text).toContain('Failed: 1');
    expect(result.content[0].text).toContain('✅ Step 1: browser_navigate');
    expect(result.content[0].text).toContain('❌ Step 2: browser_click');
    // Step 3 should not be executed
    expect(result.content[0].text).not.toContain('Step 3: browser_click');
  });

  test('should properly merge global and step-level expectations', async ({
    client,
    server,
  }) => {
    server.setContent(
      '/',
      `
      <title>Test Page</title>
      <button>Click Me</button>
    `,
      'text/html'
    );

    const result = await client.callTool({
      name: 'browser_batch_execute',
      arguments: {
        steps: [
          {
            tool: 'browser_navigate',
            arguments: { url: server.PREFIX },
            expectation: { includeSnapshot: true }, // Override global setting
          },
          {
            tool: 'browser_click',
            arguments: { element: 'Click Me button', ref: 'e2' },
            // No step-level expectation, should use global
          },
        ],
        globalExpectation: {
          includeSnapshot: false,
          includeConsole: false,
          includeTabs: false,
          includeDownloads: false,
        },
      },
    });

    expect(result.content[0].text).toContain('✅ Completed');
    expect(result.content[0].text).toContain('Successful: 2');
    expect(result.content[0].text).toContain('Failed: 0');
  });

  test('should validate unknown tool names', async ({ client }) => {
    const result = await client.callTool({
      name: 'browser_batch_execute',
      arguments: {
        steps: [
          {
            tool: 'unknown_tool',
            arguments: { param: 'value' },
          },
        ],
      },
    });

    expect(result.content[0].text).toContain('### Result');
    expect(result.content[0].text).toContain('Unknown tool: unknown_tool');
  });

  test('should handle complex batch workflows', async ({ client, server }) => {
    server.setContent(
      '/input.html',
      `
      <title>Input Page</title>
      <input id="input" type="text" />
      <button id="submit">Submit</button>
    `,
      'text/html'
    );

    const result = await client.callTool({
      name: 'browser_batch_execute',
      arguments: {
        steps: [
          {
            tool: 'browser_navigate',
            arguments: { url: `${server.PREFIX}input.html` },
            expectation: { includeSnapshot: true },
          },
          {
            tool: 'browser_type',
            arguments: { text: 'Hello World', element: 'textbox', ref: 'e2' },
            expectation: { includeSnapshot: true },
          },
          {
            tool: 'browser_click',
            arguments: { element: 'Submit button', ref: 'e3' },
            expectation: { includeSnapshot: true },
          },
        ],
        globalExpectation: {
          includeConsole: false,
          includeTabs: false,
          includeDownloads: false,
        },
      },
    });

    expect(result.content[0].text).toContain('✅ Completed');
    expect(result.content[0].text).toContain('Total Steps: 3');
    expect(result.content[0].text).toContain('Successful: 3');
    expect(result.content[0].text).toContain('Failed: 0');
  });

  test('should track execution time for each step', async ({
    client,
    server,
  }) => {
    server.setContent(
      '/',
      `
      <title>Test Page</title>
      <button>Click Me</button>
    `,
      'text/html'
    );

    const result = await client.callTool({
      name: 'browser_batch_execute',
      arguments: {
        steps: [
          {
            tool: 'browser_navigate',
            arguments: { url: server.PREFIX },
            expectation: { includeSnapshot: false },
          },
          {
            tool: 'browser_click',
            arguments: { element: 'Click Me button', ref: 'e2' },
            expectation: { includeSnapshot: false },
          },
        ],
        globalExpectation: { includeConsole: false },
      },
    });

    expect(result.content[0].text).toContain('✅ Completed');
    expect(result.content[0].text).toContain('Total Steps: 2');
    expect(result.content[0].text).toContain('Total Time:');
    expect(result.content[0].text).toMatch(MILLISECONDS_REGEX); // Should contain execution time in milliseconds
  });

  test('should handle empty steps array validation', async ({ client }) => {
    const result = await client.callTool({
      name: 'browser_batch_execute',
      arguments: {
        steps: [],
      },
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain(
      'Array must contain at least 1 element'
    );
  });

  test('should optimize token usage with minimal expectations', async ({
    client,
    server,
  }) => {
    server.setContent(
      '/',
      `
      <title>Test Page</title>
      <button>Click Me</button>
    `,
      'text/html'
    );

    const result = await client.callTool({
      name: 'browser_batch_execute',
      arguments: {
        steps: [
          {
            tool: 'browser_navigate',
            arguments: { url: server.PREFIX },
            expectation: {
              includeSnapshot: false,
              includeConsole: false,
              includeTabs: false,
              includeDownloads: false,
              includeCode: false,
            },
          },
        ],
      },
    });

    expect(result.content[0].text).toContain('✅ Completed');
    // Should have minimal content due to aggressive filtering
    expect(result.content[0].text.split('\n').length).toBeLessThan(20);
  });
});
