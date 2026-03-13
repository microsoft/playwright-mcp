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
import child_process from 'child_process';
import path from 'path';
import { test, expect } from './fixtures';

const cliPath = path.resolve(__dirname, '..', 'cli.js');

test('install-browser --help', async () => {
  const output = child_process.execSync(`node ${cliPath} install-browser --help`, { encoding: 'utf-8' });
  expect(output).toContain('install');
});
