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

import { program, Option } from 'commander';
// @ts-ignore
import { startTraceViewerServer } from 'playwright-core/lib/server';

import * as mcpTransport from './mcp/transport.js';
import { commaSeparatedList, resolveCLIConfig, semicolonSeparatedList } from './config.js';
import { packageJSON } from './package.js';
import { createExtensionClientFactory, runWithExtension } from './extension/main.js';
import { Context } from './context.js';
import { contextFactory } from './browserContextFactory.js';
import { runLoopTools } from './loopTools/main.js';
import { ProxyBackend } from './mcp/proxyBackend.js';
import { InProcessClientFactory } from './inProcessClient.js';
import { BrowserServerBackend } from './browserServerBackend.js';

import type { ClientFactoryList } from './mcp/proxyBackend.js';
import type { ServerBackendFactory } from './mcp/server.js';

program
    .version('Version ' + packageJSON.version)
    .name(packageJSON.name)
    .option('--allowed-origins <origins>', 'semicolon-separated list of origins to allow the browser to request. Default is to allow all.', semicolonSeparatedList)
    .option('--blocked-origins <origins>', 'semicolon-separated list of origins to block the browser from requesting. Blocklist is evaluated before allowlist. If used without the allowlist, requests not matching the blocklist are still allowed.', semicolonSeparatedList)
    .option('--block-service-workers', 'block service workers')
    .option('--browser <browser>', 'browser or chrome channel to use, possible values: chrome, firefox, webkit, msedge.')
    .option('--caps <caps>', 'comma-separated list of additional capabilities to enable, possible values: vision, pdf.', commaSeparatedList)
    .option('--cdp-endpoint <endpoint>', 'CDP endpoint to connect to.')
    .option('--config <path>', 'path to the configuration file.')
    .option('--device <device>', 'device to emulate, for example: "iPhone 15"')
    .option('--executable-path <path>', 'path to the browser executable.')
    .option('--headless', 'run browser in headless mode, headed by default')
    .option('--host <host>', 'host to bind server to. Default is localhost. Use 0.0.0.0 to bind to all interfaces.')
    .option('--ignore-https-errors', 'ignore https errors')
    .option('--isolated', 'keep the browser profile in memory, do not save it to disk.')
    .option('--image-responses <mode>', 'whether to send image responses to the client. Can be "allow" or "omit", Defaults to "allow".')
    .option('--no-sandbox', 'disable the sandbox for all process types that are normally sandboxed.')
    .option('--output-dir <path>', 'path to the directory for output files.')
    .option('--port <port>', 'port to listen on for SSE transport.')
    .option('--proxy-bypass <bypass>', 'comma-separated domains to bypass proxy, for example ".com,chromium.org,.domain.com"')
    .option('--proxy-server <proxy>', 'specify proxy server, for example "http://myproxy:3128" or "socks5://myproxy:8080"')
    .option('--save-session', 'Whether to save the Playwright MCP session into the output directory.')
    .option('--save-trace', 'Whether to save the Playwright Trace of the session into the output directory.')
    .option('--storage-state <path>', 'path to the storage state file for isolated sessions.')
    .option('--user-agent <ua string>', 'specify user agent string')
    .option('--user-data-dir <path>', 'path to the user data directory. If not specified, a temporary directory will be created.')
    .option('--viewport-size <size>', 'specify browser viewport size in pixels, for example "1280, 720"')
    .addOption(new Option('--extension', 'Connect to a running browser instance (Edge/Chrome only). Requires the "Playwright MCP Bridge" browser extension to be installed.').hideHelp())
    .addOption(new Option('--connect-tool', 'Allow to switch between different browser connection methods.').hideHelp())
    .addOption(new Option('--loop-tools', 'Run loop tools').hideHelp())
    .addOption(new Option('--vision', 'Legacy option, use --caps=vision instead').hideHelp())
    .action(async options => {
      setupExitWatchdog();

      if (options.vision) {
        // eslint-disable-next-line no-console
        console.error('The --vision option is deprecated, use --caps=vision instead');
        options.caps = 'vision';
      }
      const config = await resolveCLIConfig(options);

      if (options.extension) {
        await runWithExtension(config);
        return;
      }
      if (options.loopTools) {
        await runLoopTools(config);
        return;
      }

      let serverBackendFactory: ServerBackendFactory;
      const browserContextFactory = contextFactory(config);
      if (options.connectTool) {
        const factories: ClientFactoryList = [
          new InProcessClientFactory(browserContextFactory, config),
          createExtensionClientFactory(config)
        ];
        serverBackendFactory = () => new ProxyBackend(factories);
      } else {
        serverBackendFactory = () => new BrowserServerBackend(config, browserContextFactory);
      }
      await mcpTransport.start(serverBackendFactory, config.server);

      if (config.saveTrace) {
        const server = await startTraceViewerServer();
        const urlPrefix = server.urlPrefix('human-readable');
        const url = urlPrefix + '/trace/index.html?trace=' + config.browser.launchOptions.tracesDir + '/trace.json';
        // eslint-disable-next-line no-console
        console.error('\nTrace viewer listening on ' + url);
      }
    });

function setupExitWatchdog() {
  let isExiting = false;
  const handleExit = async () => {
    if (isExiting)
      return;
    isExiting = true;
    setTimeout(() => process.exit(0), 15000);
    await Context.disposeAll();
    process.exit(0);
  };

  process.stdin.on('close', handleExit);
  process.on('SIGINT', handleExit);
  process.on('SIGTERM', handleExit);
}

void program.parseAsync(process.argv);
