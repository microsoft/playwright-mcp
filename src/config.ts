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

import net from 'net';
import os from 'os';

import type { Config } from '../config';
import type { LaunchOptions, BrowserContextOptions } from 'playwright';

export type BrowserOptions = {
  browserName: 'chromium' | 'firefox' | 'webkit';
  launchOptions: LaunchOptions;
  contextOptions: BrowserContextOptions;
};

export async function toBrowserOptions(config: Config): Promise<BrowserOptions> {
  let browserName: 'chromium' | 'firefox' | 'webkit';
  let channel: string | undefined;
  switch (config.browser?.type) {
    case 'chrome':
    case 'chrome-beta':
    case 'chrome-canary':
    case 'chrome-dev':
    case 'chromium':
    case 'msedge':
    case 'msedge-beta':
    case 'msedge-canary':
    case 'msedge-dev':
      browserName = 'chromium';
      channel = config.browser.type;
      break;
    case 'firefox':
      browserName = 'firefox';
      break;
    case 'webkit':
      browserName = 'webkit';
      break;
    default:
      browserName = 'chromium';
      channel = 'chrome';
  }

  const launchOptions: LaunchOptions = {
    headless: !!(config.browser?.headless ?? (os.platform() === 'linux' && !process.env.DISPLAY)),
    channel,
    executablePath: config.browser?.executablePath,
    ...{ assistantMode: true },
  };

  const contextOptions: BrowserContextOptions = {
    viewport: null,
  };

  if (browserName === 'chromium')
    (launchOptions as any).webSocketPort = await findFreePort();

  return {
    browserName,
    launchOptions,
    contextOptions,
  };
}

async function findFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, () => {
      const { port } = server.address() as net.AddressInfo;
      server.close(() => resolve(port));
    });
    server.on('error', reject);
  });
}
