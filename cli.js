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

// Check for --always-allow flag and set the environment variable
const args = process.argv.slice(2);
const alwaysAllowIndex = args.indexOf('--always-allow');
if (alwaysAllowIndex !== -1) {
  // Set the environment variable to bypass extension approval
  process.env.PLAYWRIGHT_MCP_EXTENSION_TOKEN = 'always-allow';
  // Remove the flag from args so it doesn't cause an error in the main program
  args.splice(alwaysAllowIndex, 1);
  process.argv = [process.argv[0], process.argv[1], ...args];
}

const { program } = require('playwright-core/lib/utilsBundle');
const { decorateCommand } = require('playwright/lib/mcp/program');

const packageJSON = require('./package.json');
const p = program.version('Version ' + packageJSON.version).name('Playwright MCP');
decorateCommand(p, packageJSON.version)
void program.parseAsync(process.argv);
