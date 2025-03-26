#!/usr/bin/env node
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

import type { LaunchOptions } from 'playwright';
import type { Server } from '@modelcontextprotocol/sdk/server/index.js';

type Options = {
  /**
   * Path to the user data directory.
   */
  userDataDir?: string;

  /**
   * Launch options for the browser.
   */
  launchOptions?: LaunchOptions;

  /**
   * Use screenshots instead of snapshots. Less accurate, reliable and overall
   * slower, but contains visual representation of the page.
   * @default false
   */
  vision?: boolean;
};

export function createServer(options?: Options): Server;
