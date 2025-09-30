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

const { spawn } = require('child_process');
const path = require('path');

const projectPath = path.join(__dirname, 'dotnet', 'PlaywrightMcpServer', 'PlaywrightMcpServer.csproj');
const args = ['run', '--project', projectPath, '--', ...process.argv.slice(2)];

const child = spawn('dotnet', args, {
  stdio: ['pipe', 'pipe', 'pipe'],
  cwd: __dirname,
  env: {
    ...process.env,
    PLAYWRIGHT_BROWSERS_PATH: process.env.PLAYWRIGHT_BROWSERS_PATH || path.join(__dirname, 'node_modules', 'playwright', '.local-browsers'),
  },
});

child.on('error', error => {
  console.error(error.stack || String(error));
  process.exit(1);
});

child.on('close', code => {
  process.exit(code ?? 0);
});

process.stdin.pipe(child.stdin);
child.stdout.pipe(process.stdout);
child.stderr.pipe(process.stderr);
