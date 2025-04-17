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

import path from 'path';
import os from 'os';
import fs from 'fs';

import { createServerWithTools } from './server';
import common from './tools/common';
import console from './tools/console';
import dialogs from './tools/dialogs';
import files from './tools/files';
import install from './tools/install';
import keyboard from './tools/keyboard';
import navigate from './tools/navigate';
import pdf from './tools/pdf';
import snapshot from './tools/snapshot';
import tabs from './tools/tabs';
import screen from './tools/screen';

import type { Tool, ToolCapability } from './tools/tool';
import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import type { LaunchOptions } from 'playwright';

const snapshotTools: Tool[] = [
  ...common(true),
  ...console,
  ...dialogs(true),
  ...files(true),
  ...install,
  ...keyboard(true),
  ...navigate(true),
  ...pdf,
  ...snapshot,
  ...tabs(true),
];

const screenshotTools: Tool[] = [
  ...common(false),
  ...console,
  ...dialogs(false),
  ...files(false),
  ...install,
  ...keyboard(false),
  ...navigate(false),
  ...pdf,
  ...screen,
  ...tabs(false),
];

type Options = {
  browser?: string;
  userDataDir?: string;
  headless?: boolean;
  executablePath?: string;
  cdpEndpoint?: string;
  vision?: boolean;
  capabilities?: ToolCapability[];
};

const packageJSON = require('../package.json');

export async function createServer(options?: Options): Promise<Server> {
  let browserName: 'chromium' | 'firefox' | 'webkit';
  let channel: string | undefined;
  switch (options?.browser) {
    case 'chrome':
    case 'chrome-beta':
    case 'chrome-canary':
    case 'chrome-dev':
    case 'msedge':
    case 'msedge-beta':
    case 'msedge-canary':
    case 'msedge-dev':
      browserName = 'chromium';
      channel = options.browser;
      break;
    case 'chromium':
      browserName = 'chromium';
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
  const userDataDir = options?.userDataDir ?? await createUserDataDir(browserName);

  const launchOptions: LaunchOptions = {
    headless: !!(options?.headless ?? (os.platform() === 'linux' && !process.env.DISPLAY)),
    channel,
    executablePath: options?.executablePath,
  };

  const allTools = options?.vision ? screenshotTools : snapshotTools;
  const tools = allTools.filter(tool => !options?.capabilities || tool.capability === 'core' || options.capabilities.includes(tool.capability));
  return createServerWithTools({
    name: 'Playwright',
    version: packageJSON.version,
    tools,
    resources: [],
    browserName,
    userDataDir,
    launchOptions,
    cdpEndpoint: options?.cdpEndpoint,
  });
}

async function createUserDataDir(browserName: 'chromium' | 'firefox' | 'webkit') {
  let cacheDirectory: string;
  if (process.platform === 'linux')
    cacheDirectory = process.env.XDG_CACHE_HOME || path.join(os.homedir(), '.cache');
  else if (process.platform === 'darwin')
    cacheDirectory = path.join(os.homedir(), 'Library', 'Caches');
  else if (process.platform === 'win32')
    cacheDirectory = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
  else
    throw new Error('Unsupported platform: ' + process.platform);
  const result = path.join(cacheDirectory, 'ms-playwright', `mcp-${browserName}-profile`);
  await fs.promises.mkdir(result, { recursive: true });
  return result;
}
