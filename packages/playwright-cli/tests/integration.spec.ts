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
import { spawn } from 'child_process';
import { test, expect } from '@playwright/test';

type CliResult = {
  output: string;
  error: string;
  exitCode: number | null;
};

async function runCli(...args: string[]): Promise<CliResult> {
  const cliPath = path.join(__dirname, '../playwright-cli.js');

  return new Promise<CliResult>((resolve, reject) => {
    let stdout = '';
    let stderr = '';

    const childProcess = spawn(process.execPath, [cliPath, ...args], {
      env: {
        ...process.env,
        PLAYWRIGHT_CLI_INSTALLATION_FOR_TEST: test.info().outputPath(),
      },
      cwd: test.info().outputPath(),
    });

    childProcess.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    childProcess.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    childProcess.on('close', (code) => {
      resolve({
        output: stdout.trim(),
        error: stderr.trim(),
        exitCode: code,
      });
    });

    childProcess.on('error', reject);
  });
}

test('open data URL', async ({}) => {
  expect(await runCli('open', 'data:text/html,hello')).toEqual(expect.objectContaining({
    output: expect.stringContaining('hello'),
    exitCode: 0,
  }));

  expect(await runCli('session-delete')).toEqual(expect.objectContaining({
    output: expect.stringContaining('Deleted user data for session'),
    exitCode: 0,
  }));
});
