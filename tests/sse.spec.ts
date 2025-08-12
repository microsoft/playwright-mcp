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
import type { Config } from '../config.d.ts';
import { test as baseTest, expect } from './fixtures.js';
import {
  type SecureProcessOptions,
  SecureTestProcessManager,
} from './process-test-manager.js';

import {
  COMMON_REGEX_PATTERNS,
  createSSEClient,
  expectRegexCount,
} from './test-utils.js';

const test = baseTest.extend<{
  serverEndpoint: (
    options?: SecureProcessOptions
  ) => Promise<{ url: URL; stderr: () => string }>;
}>({
  serverEndpoint: async ({ mcpHeadless }, use, testInfo) => {
    const processManager = new SecureTestProcessManager();
    const userDataDir = testInfo.outputPath('user-data-dir');

    await use(async (options: SecureProcessOptions = {}) => {
      const processOptions: SecureProcessOptions = {
        ...options,
        userDataDir,
        headless: mcpHeadless,
      };

      const result = await processManager.spawnSecureProcess(processOptions);
      // Ensure url is always defined for this fixture
      if (!result.url) {
        throw new Error('Server URL not available');
      }
      return { url: result.url, stderr: result.stderr };
    });

    processManager.terminate();
  },
});

test('sse transport', async ({ serverEndpoint }) => {
  const { url } = await serverEndpoint();
  const { client } = await createSSEClient(url);
  await client.ping();
});

test('sse transport (config)', async ({ serverEndpoint }) => {
  const config: Config = {
    server: {
      port: 0,
    },
  };
  const configFile = test.info().outputPath('config.json');
  await fs.promises.writeFile(configFile, JSON.stringify(config, null, 2));

  const { url } = await serverEndpoint({
    noPort: true,
    args: [`--config=${configFile}`],
  });
  const { client } = await createSSEClient(url);
  await client.ping();
});

test('sse transport browser lifecycle (isolated)', async ({
  serverEndpoint,
  server,
}) => {
  const { url, stderr } = await serverEndpoint({ args: ['--isolated'] });

  const { client: client1 } = await createSSEClient(url);
  await client1.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  });
  await client1.close();

  const { client: client2 } = await createSSEClient(url);
  await client2.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  });
  await client2.close();

  // Wait a bit for all logs to be written
  await new Promise((resolve) => setTimeout(resolve, 1000));

  expectRegexCount(stderr(), COMMON_REGEX_PATTERNS.CREATE_SSE_SESSION, 2);
  expectRegexCount(stderr(), COMMON_REGEX_PATTERNS.DELETE_SSE_SESSION, 2);
  expectRegexCount(stderr(), COMMON_REGEX_PATTERNS.CREATE_CONTEXT, 2);
  expectRegexCount(stderr(), COMMON_REGEX_PATTERNS.CLOSE_CONTEXT, 2);
  expectRegexCount(
    stderr(),
    COMMON_REGEX_PATTERNS.CREATE_BROWSER_CONTEXT_ISOLATED,
    2
  );
  expectRegexCount(
    stderr(),
    COMMON_REGEX_PATTERNS.CLOSE_BROWSER_CONTEXT_ISOLATED,
    2
  );
  expectRegexCount(stderr(), COMMON_REGEX_PATTERNS.OBTAIN_BROWSER_ISOLATED, 2);
  expectRegexCount(stderr(), COMMON_REGEX_PATTERNS.CLOSE_BROWSER_ISOLATED, 2);
});

test('sse transport browser lifecycle (isolated, multiclient)', async ({
  serverEndpoint,
  server,
}) => {
  const { url, stderr } = await serverEndpoint({ args: ['--isolated'] });

  const { client: client1 } = await createSSEClient(url);
  await client1.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  });

  const { client: client2 } = await createSSEClient(url);
  await client2.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  });
  await client1.close();

  const { client: client3 } = await createSSEClient(url);
  await client3.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  });

  await client2.close();
  await client3.close();

  await expect(() => {
    expectRegexCount(stderr(), COMMON_REGEX_PATTERNS.CREATE_SSE_SESSION, 3);
    expectRegexCount(stderr(), COMMON_REGEX_PATTERNS.DELETE_SSE_SESSION, 3);
    expectRegexCount(stderr(), COMMON_REGEX_PATTERNS.CREATE_CONTEXT, 3);
    expectRegexCount(stderr(), COMMON_REGEX_PATTERNS.CLOSE_CONTEXT, 3);
    expectRegexCount(
      stderr(),
      COMMON_REGEX_PATTERNS.CREATE_BROWSER_CONTEXT_ISOLATED,
      3
    );
    expectRegexCount(
      stderr(),
      COMMON_REGEX_PATTERNS.CLOSE_BROWSER_CONTEXT_ISOLATED,
      3
    );
    expectRegexCount(
      stderr(),
      COMMON_REGEX_PATTERNS.OBTAIN_BROWSER_ISOLATED,
      1
    );
    expectRegexCount(stderr(), COMMON_REGEX_PATTERNS.CLOSE_BROWSER_ISOLATED, 1);
  }).toPass();
});

test('sse transport browser lifecycle (persistent)', async ({
  serverEndpoint,
  server,
}) => {
  const { url, stderr } = await serverEndpoint();

  const { client: client1 } = await createSSEClient(url);
  await client1.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  });
  await client1.close();

  const { client: client2 } = await createSSEClient(url);
  await client2.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  });
  await client2.close();

  await expect(() => {
    expectRegexCount(stderr(), COMMON_REGEX_PATTERNS.CREATE_SSE_SESSION, 2);
    expectRegexCount(stderr(), COMMON_REGEX_PATTERNS.DELETE_SSE_SESSION, 2);
    expectRegexCount(stderr(), COMMON_REGEX_PATTERNS.CREATE_CONTEXT, 2);
    expectRegexCount(stderr(), COMMON_REGEX_PATTERNS.CLOSE_CONTEXT, 2);
    expectRegexCount(
      stderr(),
      COMMON_REGEX_PATTERNS.CREATE_BROWSER_CONTEXT_PERSISTENT,
      2
    );
    expectRegexCount(
      stderr(),
      COMMON_REGEX_PATTERNS.CLOSE_BROWSER_CONTEXT_PERSISTENT,
      2
    );
    expectRegexCount(stderr(), COMMON_REGEX_PATTERNS.LOCK_USER_DATA_DIR, 2);
    expectRegexCount(stderr(), COMMON_REGEX_PATTERNS.RELEASE_USER_DATA_DIR, 2);
  }).toPass();
});

test('sse transport browser lifecycle (persistent, multiclient)', async ({
  serverEndpoint,
  server,
}) => {
  const { url } = await serverEndpoint();

  const { client: client1 } = await createSSEClient(url);
  await client1.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  });

  const { client: client2 } = await createSSEClient(url);
  const response = await client2.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  });
  expect(response.isError).toBe(true);
  expect(response.content?.[0].text).toContain(
    'use --isolated to run multiple instances of the same browser'
  );

  await client1.close();
  await client2.close();
});
