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
import { Connection } from '../connection.js';
import { startStdioTransport } from '../transport.js';
import { Server } from '../server.js';
import { startCDPRelayServer } from './cdpRelay.js';

export async function runWithExtension(options: any) {
  const config = await resolveCLIConfig({ });

  let connection: Connection | null = null;
  const cdpEndpoint = await startCDPRelayServer({
    getClientInfo: () => connection!.server.getClientVersion()!,
    port: 9225,
  });
  // Point CDP endpoint to the relay server.
  config.browser.cdpEndpoint = cdpEndpoint;

  const server = new Server(config);
  server.setupExitWatchdog();

  connection = await startStdioTransport(server);
}
