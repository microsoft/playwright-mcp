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
import {
  COMMON_EXPECTATIONS,
  callTool,
  createBatchExecutionArgs,
  createNavigationStep,
  expectBatchExecutionSummary,
} from './test-helpers.js';

// Top-level regex patterns for performance optimization
// Safe regex pattern to avoid ReDoS vulnerability - matches digits followed by 'ms'
const MILLISECONDS_REGEX = /\d{1,10}ms/u;

test.describe('Browser Batch Execute Basic Tests', () => {
  test('should execute basic navigation batch successfully', async ({
    client,
    server,
  }) => {
    const args = createBatchExecutionArgs(
      [
        createNavigationStep(server.HELLO_WORLD, {
          includeSnapshot: false,
          includeConsole: false,
        }),
      ],
      { includeDownloads: false, includeTabs: false }
    );

    const result = await callTool(client, 'browser_batch_execute', args);
    expectBatchExecutionSummary(result, {
      totalSteps: 1,
      successful: 1,
      failed: 0,
    });
  });

  test('should handle invalid tool name in batch', async ({ client }) => {
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

    expect(result.content[0].text).toContain('Unknown tool: unknown_tool');
  });

  test('should optimize token usage with minimal expectations', async ({
    client,
    server,
  }) => {
    const args = createBatchExecutionArgs(
      [
        createNavigationStep(
          server.HELLO_WORLD,
          COMMON_EXPECTATIONS.MINIMAL_RESPONSE
        ),
      ],
      {},
      false
    );

    const result = await callTool(client, 'browser_batch_execute', args);

    expect(result.content[0].text).toContain('✅ Completed');
    // Should have minimal content due to aggressive filtering
    const lines = result.content[0].text.split('\n');
    expect(lines.length).toBeLessThan(25);
  });

  test('should track execution time', async ({ client, server }) => {
    const args = createBatchExecutionArgs(
      [createNavigationStep(server.HELLO_WORLD, { includeSnapshot: false })],
      { includeConsole: false }
    );

    const result = await callTool(client, 'browser_batch_execute', args);

    expect(result.content[0].text).toContain('✅ Completed');
    expect(result.content[0].text).toContain('Total Time:');
    expect(result.content[0].text).toMatch(MILLISECONDS_REGEX); // Should contain execution time in milliseconds
  });
});
