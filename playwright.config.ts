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

import { defineConfig } from '@playwright/test';

import type { Project } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'list',
  projects: [
    { name: 'chrome' },
    { name: 'msedge', use: { mcpBrowser: 'msedge' } },
    { name: 'chromium', use: { mcpBrowser: 'chromium' } },
    { name: 'firefox', use: { mcpBrowser: 'firefox' } },
    // Firefox headless fails on windows bots, see https://bugzilla.mozilla.org/show_bug.cgi?id=1960787
    process.platform === 'win32' ? undefined :
      {
        name: 'moz-firefox',
        use: {
          mcpBrowser: 'moz-firefox',
          // We currently look at /snap/bin/firefox on Linux by default, but on GHA it's not there.
          mcpExecutablePath: process.platform === 'linux' ? '/usr/bin/firefox' : undefined
        }
      },
    { name: 'webkit', use: { mcpBrowser: 'webkit' } },
  ].filter(Boolean) as Project[],
});
