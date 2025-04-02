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
import * as snapshot from './tools/snapshot';
import * as common from './tools/common';
import * as screenshot from './tools/screenshot';
import * as mock from './tools/mock';
import { console } from './resources/console';

import type { Tool } from './tools/tool';
import type { Resource } from './resources/resource';
import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import type { LaunchOptions } from 'playwright';

const commonTools: Tool[] = [
  common.pressKey,
  common.wait,
  common.pdf,
  common.close,
  common.install,
];

const snapshotTools: Tool[] = [
  common.navigate(true),
  common.goBack(true),
  common.goForward(true),
  common.chooseFile(true),
  snapshot.snapshot,
  snapshot.click,
  snapshot.hover,
  snapshot.type,
  snapshot.selectOption,
  snapshot.screenshot,
  mock.mockApi(true),
  mock.clearMock(true),
  ...commonTools,
];

const screenshotTools: Tool[] = [
  common.navigate(false),
  common.goBack(false),
  common.goForward(false),
  common.chooseFile(false),
  screenshot.screenshot,
  screenshot.moveMouse,
  screenshot.click,
  screenshot.drag,
  screenshot.type,
  mock.mockApi(false),
  mock.clearMock(false),
  ...commonTools,
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
