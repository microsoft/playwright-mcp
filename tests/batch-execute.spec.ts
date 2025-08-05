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

test.describe('Browser Batch Execute', () => {
  test('should execute multiple navigation and interaction steps in sequence', async ({ client, server }) => {
    // Setup test page with clickable button
    server.setContent('/', `
      <title>Test Page</title>
      <button data-testid="success">Click Me</button>
    `, 'text/html');

    const result = await client.callTool({
      name: 'browser_batch_execute',
      arguments: {
        steps: [
          {
            tool: 'browser_navigate',
            arguments: { url: server.PREFIX },
            expectation: { includeSnapshot: false, includeConsole: false }
          },
          {
            tool: 'browser_click',
            arguments: { element: 'button', ref: 'button[data-testid="success"]' },
            expectation: { includeSnapshot: true, includeConsole: false }
          }
        ],
        stopOnFirstError: true,
        globalExpectation: { includeDownloads: false, includeTabs: false }
      }
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

  test('should handle batch execution with individual step errors when continueOnError=true', async ({ runTool, server }) => {
    const result = await runTool('browser_batch_execute', {
      steps: [
        {
          tool: 'browser_navigate',
          arguments: { url: server.PREFIX },
          expectation: { includeSnapshot: false }
        },
        {
          tool: 'browser_click',
          arguments: { element: 'button', ref: 'button[data-testid="nonexistent"]' },
          continueOnError: true,
          expectation: { includeSnapshot: false }
        },
        {
          tool: 'browser_click',
          arguments: { element: 'button', ref: 'button[data-testid="success"]' },
          expectation: { includeSnapshot: true }
        }
      ],
      stopOnFirstError: false
    });

    expect(result).toContain('Batch Execution Summary');
    expect(result).toContain('Total Steps: 3');
    expect(result).toContain('Successful: 2');
    expect(result).toContain('Failed: 1');
    expect(result).toContain('✅ Step 1: browser_navigate');
    expect(result).toContain('❌ Step 2: browser_click');
    expect(result).toContain('✅ Step 3: browser_click');
  });

  test('should stop on first error when stopOnFirstError=true and step has continueOnError=false', async ({ runTool, server }) => {
    const result = await runTool('browser_batch_execute', {
      steps: [
        {
          tool: 'browser_navigate',
          arguments: { url: server.PREFIX },
          expectation: { includeSnapshot: false }
        },
        {
          tool: 'browser_click',
          arguments: { element: 'button', ref: 'button[data-testid="nonexistent"]' },
          continueOnError: false,
          expectation: { includeSnapshot: false }
        },
        {
          tool: 'browser_click',
          arguments: { element: 'button', ref: 'button[data-testid="success"]' },
          expectation: { includeSnapshot: false }
        }
      ],
      stopOnFirstError: true
    });

    expect(result).toContain('Batch Execution Summary');
    expect(result).toContain('❌ Stopped on Error');
    expect(result).toContain('Total Steps: 3');
    expect(result).toContain('Successful: 1');
    expect(result).toContain('Failed: 1');
    expect(result).toContain('✅ Step 1: browser_navigate');
    expect(result).toContain('❌ Step 2: browser_click');
    // Step 3 should not be executed
    expect(result).not.toContain('Step 3: browser_click');
  });

  test('should properly merge global and step-level expectations', async ({ runTool, server }) => {
    const result = await runTool('browser_batch_execute', {
      steps: [
        {
          tool: 'browser_navigate',
          arguments: { url: server.PREFIX },
          expectation: { includeSnapshot: true } // Override global setting
        },
        {
          tool: 'browser_click',
          arguments: { element: 'button', ref: 'button[data-testid="success"]' }
          // No step-level expectation, should use global
        }
      ],
      globalExpectation: {
        includeSnapshot: false,
        includeConsole: false,
        includeTabs: false,
        includeDownloads: false
      }
    });

    expect(result).toContain('✅ Completed');
    expect(result).toContain('Successful: 2');
    expect(result).toContain('Failed: 0');
  });

  test('should validate unknown tool names', async ({ runTool }) => {
    const result = await runTool('browser_batch_execute', {
      steps: [
        {
          tool: 'unknown_tool',
          arguments: { param: 'value' }
        }
      ]
    });

    expect(result).toContain('### Result');
    expect(result).toContain('Unknown tool: unknown_tool');
  });

  test('should handle complex batch workflows', async ({ runTool, server }) => {
    const result = await runTool('browser_batch_execute', {
      steps: [
        {
          tool: 'browser_navigate',
          arguments: { url: server.PREFIX + '/input.html' },
          expectation: { includeSnapshot: false }
        },
        {
          tool: 'browser_type',
          arguments: { text: 'Hello World', element: 'input', ref: '#input' },
          expectation: { includeSnapshot: false }
        },
        {
          tool: 'browser_click',
          arguments: { element: 'button', ref: '#submit' },
          expectation: { includeSnapshot: true }
        }
      ],
      globalExpectation: {
        includeConsole: false,
        includeTabs: false,
        includeDownloads: false
      }
    });

    expect(result).toContain('✅ Completed');
    expect(result).toContain('Total Steps: 3');
    expect(result).toContain('Successful: 3');
    expect(result).toContain('Failed: 0');
  });

  test('should track execution time for each step', async ({ runTool, server }) => {
    const result = await runTool('browser_batch_execute', {
      steps: [
        {
          tool: 'browser_navigate',
          arguments: { url: server.PREFIX },
          expectation: { includeSnapshot: false }
        },
        {
          tool: 'wait',
          arguments: { duration: 100 }, // 100ms wait
          expectation: { includeSnapshot: false }
        }
      ],
      globalExpectation: { includeConsole: false }
    });

    expect(result).toContain('✅ Completed');
    expect(result).toContain('Total Steps: 2');
    expect(result).toContain('Total Time:');
    expect(result).toMatch(/\d+ms/); // Should contain execution time in milliseconds
  });

  test('should handle empty steps array validation', async ({ runTool }) => {
    await expect(runTool('browser_batch_execute', {
      steps: []
    })).rejects.toThrow();
  });

  test('should optimize token usage with minimal expectations', async ({ runTool, server }) => {
    const result = await runTool('browser_batch_execute', {
      steps: [
        {
          tool: 'browser_navigate',
          arguments: { url: server.PREFIX },
          expectation: {
            includeSnapshot: false,
            includeConsole: false,
            includeTabs: false,
            includeDownloads: false,
            includeCode: false
          }
        }
      ]
    });

    expect(result).toContain('✅ Completed');
    // Should have minimal content due to aggressive filtering
    expect(result.split('\n').length).toBeLessThan(20);
  });
});
