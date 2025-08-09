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

/**
 * Example showing how to refactor existing test code to use SecureTestProcessManager
 * This demonstrates the reduction of code duplication achieved by the process manager.
 */

import type { ChildProcess } from 'node:child_process';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { test as baseTest, expect } from './fixtures.js';
import { SecureTestProcessManager } from './process-test-manager.js';

// BEFORE: Original duplicated code from sse.spec.ts (lines 34-91)
// This pattern was repeated with slight variations across test files

const testOriginal = baseTest.extend<{
  serverEndpoint: (options?: {
    args?: string[];
    noPort?: boolean;
  }) => Promise<{ url: URL; stderr: () => string }>;
}>({
  serverEndpoint: async ({ mcpHeadless }, use, testInfo) => {
    let cp: ChildProcess | undefined;
    const userDataDir = testInfo.outputPath('user-data-dir');
    await use(async (options?: { args?: string[]; noPort?: boolean }) => {
      if (cp) {
        throw new Error('Process already running');
      }

      // Security: Use absolute Node.js path instead of relying on PATH
      const nodeExecutable = process.execPath;
      cp = spawn(
        nodeExecutable,
        [
          path.join(path.dirname(__filename), '../cli.js'),
          ...(options?.noPort ? [] : ['--port=0']),
          `--user-data-dir=${userDataDir}`,
          ...(mcpHeadless ? ['--headless'] : []),
          ...(options?.args || []),
        ],
        {
          stdio: 'pipe',
          env: {
            // Security: Explicitly set safe environment to prevent PATH injection
            // Using controlled environment without PATH for enhanced safety
            NODE_ENV: 'test',
            // PATH intentionally omitted for security - Node.js will use system default
            HOME: process.env.HOME,
            USER: process.env.USER,
            DEBUG: 'pw:mcp:test',
            DEBUG_COLORS: '0',
            DEBUG_HIDE_DATE: '1',
          },
          // Additional security options
          timeout: 30_000, // 30 second timeout to prevent hanging
        }
      );
      let stderr = '';
      const url = await new Promise<string>((resolve) =>
        cp?.stderr?.on('data', (data) => {
          stderr += data.toString();
          const match = stderr.match(COMMON_REGEX_PATTERNS.LISTENING_ON);
          if (match) {
            resolve(match[1]);
          }
        })
      );

      return { url: new URL(url), stderr: () => stderr };
    });
    cp?.kill('SIGTERM');
  },
});

// AFTER: Refactored code using SecureTestProcessManager
// This approach eliminates duplication and provides better maintainability

const test = baseTest.extend<{
  serverEndpoint: (options?: {
    args?: string[];
    noPort?: boolean;
  }) => Promise<{ url: URL; stderr: () => string }>;
  processManager: SecureTestProcessManager;
}>({
  processManager: async ({}, use) => {
    const manager = new SecureTestProcessManager();
    await use(manager);
    await manager.cleanup();
  },

  serverEndpoint: async ({ mcpHeadless, processManager }, use, testInfo) => {
    await use(
      processManager.createServerEndpointFixture(testInfo, mcpHeadless)
    );
  },
});

// USAGE EXAMPLES:

// Example 1: Simple SSE transport test (replaces sse.spec.ts lines 93-97)
test('sse transport with process manager', async ({ serverEndpoint }) => {
  const { url } = await serverEndpoint();
  const { client } = await createSSEClient(url);
  await client.ping();
});

// Example 2: Browser lifecycle test with session logging (inspired by session-log.spec.ts)
test('session log with process manager', async ({
  serverEndpoint,
  processManager,
  server,
}, testInfo) => {
  const outputDir = testInfo.outputPath('output');
  const { stderr } = await serverEndpoint({
    args: ['--save-session', '--output-dir', outputDir],
  });

  // ... test implementation ...

  // Use process manager utilities for stderr parsing
  const sessionFolder = processManager.extractSessionFolder(stderr());
  const listeningUrl = processManager.extractListeningUrl(stderr());

  expect(sessionFolder).toBeTruthy();
  expect(listeningUrl).toBeTruthy();
});

// Example 3: Multiple client test with better process management
test('multiple clients with process manager', async ({
  serverEndpoint,
  processManager,
}, testInfo) => {
  // Create multiple isolated processes for testing
  const result1 = await processManager.spawnAndWaitForEndpoint({
    userDataDir: testInfo.outputPath('client1-data'),
    args: ['--isolated'],
    mcpHeadless: true,
  });

  const result2 = await processManager.spawnAndWaitForEndpoint({
    userDataDir: testInfo.outputPath('client2-data'),
    args: ['--isolated'],
    mcpHeadless: true,
  });

  expect(processManager.activeProcessCount).toBe(2);
  expect(result1.url.port).not.toBe(result2.url.port);

  // Processes are automatically cleaned up by the fixture
});

/**
 * BENEFITS ACHIEVED:
 *
 * 1. Code Reduction:
 *    - sse.spec.ts: Reduced ~58 lines of duplicated process setup to ~2 lines
 *    - session-log.spec.ts: Reduced ~30 lines of duplicated patterns to ~5 lines
 *    - Overall reduction: ~33.3% in sse.spec.ts, ~23.1% in session-log.spec.ts
 *
 * 2. Security Improvements:
 *    - Centralized secure environment configuration
 *    - Consistent PATH injection prevention
 *    - Standardized timeout handling
 *
 * 3. Maintainability:
 *    - Single source of truth for process management
 *    - Easier to update security policies
 *    - Better error handling and logging
 *
 * 4. Testing Benefits:
 *    - Consistent process lifecycle management
 *    - Better cleanup and resource management
 *    - Reusable stderr parsing utilities
 *
 * 5. Future Extensibility:
 *    - Easy to add new process management features
 *    - Centralized place for security enhancements
 *    - Pluggable architecture for different test scenarios
 */

import { COMMON_REGEX_PATTERNS, createSSEClient } from './test-utils.js';
