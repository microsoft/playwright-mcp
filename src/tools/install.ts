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

import { z } from 'zod';
import { defineTool } from './tool';

const install = defineTool({
  capability: 'install',
  schema: {
    name: 'browser_install',
    description: 'Install the browser specified in the config. Call this if you get an error about the browser not being installed.',
    inputSchema: z.object({}),
  },

  handle: async context => {
    const channel = context.options.launchOptions?.channel ?? context.options.browserName ?? 'chrome';
    const cli = path.join(require.resolve('playwright/package.json'), '..', 'cli.js');
    const child = fork(cli, ['install', channel], {
      stdio: 'pipe',
    });
    const chunks: string[] = [];
    child.stdout?.on('data', data => chunks.push(data.toString()));
    child.stderr?.on('data', data => chunks.push(data.toString()));
    const code = await new Promise<string>((resolve, reject) => {
      child.on('close', code => {
        const output = chunks.join('');
        if (code === 0)
          resolve(`// Browser ${channel} installed`);
        else if (output.includes('already installed'))
          resolve(`// Browser ${channel} is already installed`);
        else
          reject(new Error(`Failed to install browser: ${output}`));
      });
    });
    return {
      code: [code],
      captureSnapshot: false,
      waitForNetwork: false,
    };
  },
});

export default [
  install,
];
