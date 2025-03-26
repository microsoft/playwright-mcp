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
    .option('--vision', 'Run server that uses screenshots (Aria snapshots are used by default)')
    .action(async options => {
      const launchOptions: LaunchOptions = {
        headless: !!options.headless,
      };
      const server = createServer({ launchOptions });
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
