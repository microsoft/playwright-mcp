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

import { test, expect } from '@playwright/test';
import childProcess from 'child_process';

function runCLI(args: string[]) {
  return childProcess.spawnSync(process.execPath, [require.resolve('../playwright-cli'), ...args], { encoding: 'utf-8' });
}

test('prints help', async () => {
  const { stdout } = runCLI(['--help']);
  expect(stdout).toContain('Usage: playwright-cli <command>');
});

test('prints version', async () => {
  const { stdout } = runCLI(['--version']);
  expect(stdout).toContain(require('../package.json').version);
});
