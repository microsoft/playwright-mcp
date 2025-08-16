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

import { fork } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { z } from 'zod';
import { defineTool } from './tool.js';


// Progress notification constants
const PROGRESS_UPDATE_INTERVAL_MS = 5000; // Send progress update every 5 seconds
const INDETERMINATE_PROGRESS_MAX = 100; // Maximum value for cycling progress indicator

const install = defineTool({
  capability: 'core-install',
  schema: {
    name: 'browser_install',
    title: 'Install the browser specified in the config',
    description: 'Install the browser specified in the config. Call this if you get an error about the browser not being installed.',
    inputSchema: z.object({}),
    type: 'destructive',
  },

  handle: async (context, _params, response) => {
    const channel = context.config.browser?.launchOptions?.channel ?? context.config.browser?.browserName ?? 'chrome';
    const cliUrl = import.meta.resolve('playwright/package.json');
    const cliPath = path.join(fileURLToPath(cliUrl), '..', 'cli.js');
    const child = fork(cliPath, ['install', channel], {
      stdio: 'pipe',
    });
    const output: string[] = [];

    // Send periodic progress notifications (indeterminate progress)
    // Progress cycles from 0 to INDETERMINATE_PROGRESS_MAX-1 to show activity
    let progressValue = 0;
    const progressInterval = response.sendProgress ? setInterval(async () => {
      progressValue = (progressValue + 1) % INDETERMINATE_PROGRESS_MAX;
      await response.sendProgress(progressValue); // Send without total for indeterminate
    }, PROGRESS_UPDATE_INTERVAL_MS) : undefined;

    child.stdout?.on('data', (data: Buffer) => output.push(data.toString()));
    child.stderr?.on('data', (data: Buffer) => output.push(data.toString()));

    try {
      await new Promise<void>((resolve, reject) => {
        child.on('close', code => {
          if (code === 0)
            resolve();
          else
            reject(new Error(`Failed to install browser: ${output.join('')}`));
        });
      });
    } finally {
      clearInterval(progressInterval);
    }

    response.setIncludeTabs();
  },
});

export default [
  install,
];
