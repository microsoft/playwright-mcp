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

import { startHttpTransport, startStdioTransport } from './transport.js';
import { resolveCLIConfig } from './config.js';
// @ts-ignore
import { startTraceViewerServer } from 'playwright-core/lib/server';

import type { Connection } from './connection.js';
import { packageJSON } from './context.js';

program
    .version('Version ' + packageJSON.version)
    .name(packageJSON.name)
    .option('--allowed-origins <origins>', 'semicolon-separated list of origins to allow the browser to request. Default is to allow all.', semicolonSeparatedList)
    .option('--blocked-origins <origins>', 'semicolon-separated list of origins to block the browser from requesting. Blocklist is evaluated before allowlist. If used without the allowlist, requests not matching the blocklist are still allowed.', semicolonSeparatedList)
    .option('--block-service-workers', 'block service workers')
    .option('--browser <browser>', 'browser or chrome channel to use, possible values: chrome, firefox, webkit, msedge.')
    .option('--caps <caps>', 'comma-separated list of capabilities to enable, possible values: tabs, pdf, history, wait, files, install. Default is all.')
    .option('--cdp-endpoint <endpoint>', 'CDP endpoint to connect to.')
    .option('--config <path>', 'path to the configuration file.')
    .option('--device <device>', 'device to emulate, for example: "iPhone 15"')
    .option('--executable-path <path>', 'path to the browser executable.')
    .option('--headless', 'run browser in headless mode, headed by default')
    .option('--host <host>', 'host to bind server to. Default is localhost. Use 0.0.0.0 to bind to all interfaces.')
    .option('--ignore-https-errors', 'ignore https errors')
    .option('--isolated', 'keep the browser profile in memory, do not save it to disk.')
    .option('--no-image-responses', 'do not send image responses to the client.')
    .option('--no-sandbox', 'disable the sandbox for all process types that are normally sandboxed.')
    .option('--output-dir <path>', 'path to the directory for output files.')
    .option('--port <port>', 'port to listen on for SSE transport.')
    .option('--proxy-bypass <bypass>', 'comma-separated domains to bypass proxy, for example ".com,chromium.org,.domain.com"')
    .option('--proxy-server <proxy>', 'specify proxy server, for example "http://myproxy:3128" or "socks5://myproxy:8080"')
    .option('--save-trace', 'Whether to save the Playwright Trace of the session into the output directory.')
    .option('--storage-state <path>', 'path to the storage state file for isolated sessions.')
    .option('--user-agent <ua string>', 'specify user agent string')
    .option('--user-data-dir <path>', 'path to the user data directory. If not specified, a temporary directory will be created.')
    .option('--viewport-size <size>', 'specify browser viewport size in pixels, for example "1280, 720"')
    .option('--vision', 'Run server that uses screenshots (Aria snapshots are used by default)')
    .action(async options => {
      const config = await resolveCLIConfig(options);
      const connectionList: Connection[] = [];
      setupExitWatchdog(connectionList);

      if (options.port)
        startHttpTransport(config, +options.port, options.host, connectionList);
      else
        await startStdioTransport(config, connectionList);

      if (config.saveTrace) {
        const server = await startTraceViewerServer();
        const urlPrefix = server.urlPrefix('human-readable');
        const url = urlPrefix + '/trace/index.html?trace=' + config.browser.launchOptions.tracesDir + '/trace.json';
        // eslint-disable-next-line no-console
        console.error('\nTrace viewer listening on ' + url);
      }
    });

function setupExitWatchdog(connectionList: Connection[]) {
  const handleExit = async () => {
    setTimeout(() => process.exit(0), 15000);
    for (const connection of connectionList)
      await connection.close();
    process.exit(0);
  };

  process.stdin.on('close', handleExit);
  process.on('SIGINT', handleExit);
  process.on('SIGTERM', handleExit);
}

function semicolonSeparatedList(value: string): string[] {
  return value.split(';').map(v => v.trim());
}

program.parse(process.argv);
