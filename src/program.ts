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

import { createServer } from './index.js';
import { ServerList } from './server.js';

import { startHttpTransport, startStdioTransport } from './transport.js';

import { resolveConfig } from './config.js';

import packageJSON from '../package.json' with { type: 'json' };

program
    .version('Version ' + packageJSON.version)
    .name(packageJSON.name)
    .option('--browser <browser>', 'Browser or chrome channel to use, possible values: chrome, firefox, webkit, msedge.')
    .option('--caps <caps>', 'Comma-separated list of capabilities to enable, possible values: tabs, pdf, history, wait, files, install. Default is all.')
    .option('--cdp-endpoint <endpoint>', 'CDP endpoint to connect to.')
    .option('--executable-path <path>', 'Path to the browser executable.')
    .option('--headless', 'Run browser in headless mode, headed by default')
    .option('--device <device>', 'Device to emulate, for example: "iPhone 15"')
    .option('--user-data-dir <path>', 'Path to the user data directory')
    .option('--port <port>', 'Port to listen on for SSE transport.')
    .option('--host <host>', 'Host to bind server to. Default is localhost. Use 0.0.0.0 to bind to all interfaces.')
    .option('--vision', 'Run server that uses screenshots (Aria snapshots are used by default)')
    .option('--config <path>', 'Path to the configuration file.')
    .action(async options => {
      const config = await resolveConfig(options);
      const serverList = new ServerList(() => createServer(config));
      setupExitWatchdog(serverList);

      if (options.port)
        startHttpTransport(+options.port, options.host, serverList);
      else
        await startStdioTransport(serverList);
    });

function setupExitWatchdog(serverList: ServerList) {
  const handleExit = async () => {
    setTimeout(() => process.exit(0), 15000);
    await serverList.closeAll();
    process.exit(0);
  };

  process.stdin.on('close', handleExit);
  process.on('SIGINT', handleExit);
  process.on('SIGTERM', handleExit);
}

program.parse(process.argv);
