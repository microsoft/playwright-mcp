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

import { Config } from '../config.js';
import { test, expect } from './fixtures.js';

test('config user data dir', async ({ startClient, localOutputPath, server }) => {
  server.setContent('/', `
    <title>Title</title>
    <body>Hello, world!</body>
  `, 'text/html');

  const config: Config = {
    browser: {
      userDataDir: localOutputPath('user-data-dir'),
    },
  };
  const configPath = localOutputPath('config.json');
  await fs.promises.writeFile(configPath, JSON.stringify(config, null, 2));

  const client = await startClient({ args: ['--config', configPath] });
  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  })).toContainTextContent(`Hello, world!`);

  const files = await fs.promises.readdir(config.browser!.userDataDir!);
  expect(files.length).toBeGreaterThan(0);
});
