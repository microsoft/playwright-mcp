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
import os from 'os';
import path from 'path';

import { program } from 'commander';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { createServer } from './index';

import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import type { LaunchOptions } from 'playwright';

const packageJSON = require('../package.json');

program
    .version('Version ' + packageJSON.version)
    .name(packageJSON.name)
    .option('--headless', 'Run browser in headless mode, headed by default')
    .option('--user-data-dir <path>', 'Path to the user data directory')
    .option('--vision', 'Run server that uses screenshots (Aria snapshots are used by default)')
    .action(async options => {
      const launchOptions: LaunchOptions = {
        headless: !!options.headless,
        channel: 'chrome',
      };
      const server = createServer({
        userDataDir: options.userDataDir ?? await userDataDir(),
        launchOptions,
        vision: !!options.vision,
      });
      setupExitWatchdog(server);

      const transport = new StdioServerTransport();
      await server.connect(transport);
    });

function setupExitWatchdog(server: Server) {
  process.stdin.on('close', async () => {
    setTimeout(() => process.exit(0), 15000);
    await server.close();
    process.exit(0);
  });
}

program.parse(process.argv);

async function userDataDir() {
  let cacheDirectory: string;
  if (process.platform === 'linux')
    cacheDirectory = process.env.XDG_CACHE_HOME || path.join(os.homedir(), '.cache');
  else if (process.platform === 'darwin')
    cacheDirectory = path.join(os.homedir(), 'Library', 'Caches');
  else if (process.platform === 'win32')
    cacheDirectory = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
  else
    throw new Error('Unsupported platform: ' + process.platform);
  const result = path.join(cacheDirectory, 'ms-playwright', 'mcp-chrome-profile');
  await fs.promises.mkdir(result, { recursive: true });
  return result;
}
