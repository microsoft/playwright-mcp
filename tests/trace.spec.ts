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
import path from 'path';

import { test, expect } from './fixtures.js';

test('check that trace is saved', async ({ startClient, server, mcpMode }, testInfo) => {
  test.fixme(mcpMode === 'extension', 'Tracing is not supported via CDP');

  const outputDir = testInfo.outputPath('output');

  const { client } = await startClient({
    args: ['--save-trace', `--output-dir=${outputDir}`],
  });

  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  })).toContainTextContent(`Navigate to http://localhost`);

  expect(fs.existsSync(path.join(outputDir, 'traces', 'trace.trace'))).toBeTruthy();
});
