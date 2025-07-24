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

import { startCDPRelayServer } from './cdpRelay.js';
import { BrowserServerBackend } from '../browserServerBackend.js';
import * as mcpTransport from '../mcp/transport.js';

import type { FullConfig } from '../config.js';

export async function runWithExtension(config: FullConfig, abortController: AbortController) {
  const contextFactory = await startCDPRelayServer(config.browser.launchOptions.channel || 'chrome', abortController);
  const serverBackendFactory = () => new BrowserServerBackend(config, contextFactory);
  await mcpTransport.start(serverBackendFactory, config.server);
}
