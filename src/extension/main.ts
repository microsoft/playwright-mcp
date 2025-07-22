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

import { resolveCLIConfig } from '../config.js';
import { startHttpServer, startHttpTransport, startStdioTransport } from '../transport.js';
import { Server } from '../server.js';
import { startCDPRelayServer } from './cdpRelay.js';

import type { CLIOptions } from '../config.js';

export async function runWithExtension(options: CLIOptions) {
  const config = await resolveCLIConfig(options);
  const contextFactory = await startCDPRelayServer(9225, config.browser.launchOptions.channel || 'chrome');

  const server = new Server(config, contextFactory);
  server.setupExitWatchdog();

  if (options.port !== undefined) {
    const httpServer = await startHttpServer({ port: options.port });
    startHttpTransport(httpServer, server);
  } else {
    await startStdioTransport(server);
  }
}
