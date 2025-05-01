/**
 * Copyright (c) Microsoft Corporation.
 * Modified by Limetest.
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

// import * as snapshot from '@best/core';
// import * as common from '@best/core';
// import * as screenshot from '@best/core';

import { createServerWithTools } from './server';
import * as limetest from '@limetest/limetest';
import { console } from '@limetest/core';

import type { Tool } from '@limetest/core';
import type { Resource } from '@limetest/core';
import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import type { LaunchOptions } from 'playwright';

const limetestTools: Tool[] = [
  limetest.limetest
];

// const commonTools: Tool[] = [
//   common.pressKey,
//   common.wait,
//   common.pdf,
//   common.close,
// ];

// const snapshotTools: Tool[] = [
//   common.navigate(true),
//   common.goBack(true),
//   common.goForward(true),
//   common.chooseFile(true),
//   snapshot.snapshot,
//   snapshot.click,
//   snapshot.drag,
//   snapshot.hover,
//   snapshot.type,
//   snapshot.selectOption,
//   snapshot.screenshot,
//   ...commonTools,
// ];

// const screenshotTools: Tool[] = [
//   common.navigate(false),
//   common.goBack(false),
//   common.goForward(false),
//   common.chooseFile(false),
//   screenshot.screenshot,
//   screenshot.moveMouse,
//   screenshot.click,
//   screenshot.drag,
//   screenshot.type,
//   ...commonTools,
// ];

const resources: Resource[] = [
  console,
];

type Options = {
  userDataDir?: string;
  launchOptions?: LaunchOptions;
  cdpEndpoint?: string;
  // vision?: boolean;
  // endtoend?: boolean;
  apiKey?: string;
};

const packageJSON = require('../package.json');

export function createServer(options?: Options): Server {
  // const tools = options?.endtoend ? qaTools : (options?.vision ? screenshotTools : snapshotTools);
  const tools = limetestTools;
  return createServerWithTools({
    name: 'Playwright',
    version: packageJSON.version,
    tools,
    resources,
    userDataDir: options?.userDataDir ?? '',
    launchOptions: options?.launchOptions,
    cdpEndpoint: options?.cdpEndpoint,
    apiKey: options?.apiKey,
  });
}
