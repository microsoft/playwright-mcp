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

import { createServerWithTools } from './server';
import common from './tools/common';
import fileChooser from './tools/fileChooser';
import install from './tools/install';
import keyboard from './tools/keyboard';
import navigate from './tools/navigate';
import pdf from './tools/pdf';
import snapshot from './tools/snapshot';
import tabs from './tools/tabs';
import screen from './tools/screen';
import { console } from './resources/console';

import type { Tool } from './tools/tool';
import type { Resource } from './resources/resource';
import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import type { LaunchOptions } from 'playwright';

const snapshotTools: Tool[] = [
  ...common,
  ...fileChooser(true),
  ...install,
  ...keyboard(true),
  ...navigate(true),
  ...pdf,
  ...snapshot,
  ...tabs(true),
];

const screenshotTools: Tool[] = [
  ...common,
  ...fileChooser(false),
  ...install,
  ...keyboard(false),
  ...navigate(false),
  ...pdf,
  ...screen,
  ...tabs(false),
];

const resources: Resource[] = [
  console,
];

type Options = {
  browserName?: 'chromium' | 'firefox' | 'webkit';
  userDataDir?: string;
  launchOptions?: LaunchOptions;
  cdpEndpoint?: string;
  vision?: boolean;
};

const packageJSON = require('../package.json');

export function createServer(options?: Options): Server {
  const tools = options?.vision ? screenshotTools : snapshotTools;
  return createServerWithTools({
    name: 'Playwright',
    version: packageJSON.version,
    tools,
    resources,
    browserName: options?.browserName,
    userDataDir: options?.userDataDir ?? '',
    launchOptions: options?.launchOptions,
    cdpEndpoint: options?.cdpEndpoint,
  });
}
