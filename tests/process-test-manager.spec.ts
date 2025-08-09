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
import { SecureTestProcessManager } from './secure-test-process-manager.js';

test('SecureTestProcessManager can spawn and terminate processes', async ({
  testInfo,
}) => {
  const manager = new SecureTestProcessManager();

  try {
    const userDataDir = testInfo.outputPath('user-data-dir');
    const result = await manager.spawnAndWaitForEndpoint({
      args: ['--port=0'],
      userDataDir,
      mcpHeadless: true,
    });

    expect(result.url).toBeDefined();
    expect(result.url.protocol).toBe('http:');
    expect(result.process).toBeDefined();
    expect(manager.activeProcessCount).toBe(1);

    // Test stderr parsing
    const stderr = result.stderr();
    expect(stderr).toContain('Listening on');

    const extractedUrl = manager.extractListeningUrl(stderr);
    expect(extractedUrl).toBe(result.url.toString());

    await manager.terminateProcess(result.process);
    expect(manager.activeProcessCount).toBe(0);
  } finally {
    await manager.cleanup();
  }
});

test('SecureTestProcessManager handles multiple processes', async ({
  testInfo,
}) => {
  const manager = new SecureTestProcessManager();

  try {
    const userDataDir1 = testInfo.outputPath('user-data-dir-1');
    const userDataDir2 = testInfo.outputPath('user-data-dir-2');

    const result1 = await manager.spawnAndWaitForEndpoint({
      args: ['--port=0'],
      userDataDir: userDataDir1,
      mcpHeadless: true,
    });

    const result2 = await manager.spawnAndWaitForEndpoint({
      args: ['--port=0'],
      userDataDir: userDataDir2,
      mcpHeadless: true,
    });

    expect(manager.activeProcessCount).toBe(2);
    expect(result1.url.port).not.toBe(result2.url.port);

    await manager.terminateAllProcesses();
    expect(manager.activeProcessCount).toBe(0);
  } finally {
    await manager.cleanup();
  }
});

test('SecureTestProcessManager creates secure environment', async ({
  testInfo,
}) => {
  const manager = new SecureTestProcessManager();

  try {
    const userDataDir = testInfo.outputPath('user-data-dir');
    const result = await manager.spawnSecureProcess({
      args: ['--help'], // Use help to avoid server startup
      userDataDir,
      additionalEnv: { TEST_VAR: 'test_value' },
    });

    expect(result.process).toBeDefined();
    expect(manager.activeProcessCount).toBe(1);

    // Wait a moment for the process to start and potentially output
    await new Promise((resolve) => setTimeout(resolve, 100));

    await manager.terminateProcess(result.process);
    expect(manager.activeProcessCount).toBe(0);
  } finally {
    await manager.cleanup();
  }
});

test('SecureTestProcessManager creates fixture-compatible endpoint function', async ({
  testInfo,
}) => {
  const manager = new SecureTestProcessManager();

  try {
    const serverEndpoint = manager.createServerEndpointFixture(testInfo, true);

    const { url, stderr } = await serverEndpoint({
      args: ['--isolated'],
    });

    expect(url).toBeDefined();
    expect(url.protocol).toBe('http:');
    expect(typeof stderr).toBe('function');
    expect(stderr()).toContain('Listening on');
  } finally {
    await manager.cleanup();
  }
});
