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

const path = require('path');
const { program } = require('playwright-core/lib/utilsBundle');
const { decorateMCPCommand } = require('playwright/lib/mcp/program');
const playwrightDir = path.dirname(require.resolve('playwright/package.json'));
const { commaSeparatedList } = require(path.join(playwrightDir, 'lib/mcp/browser/config'));
const { startCustomServer } = require('./src/custom-server');

const packageJSON = require('./package.json');
const p = program.version('Version ' + packageJSON.version).name('Playwright MCP');

// Register all standard Playwright MCP options via decorateMCPCommand
decorateMCPCommand(p, packageJSON.version);

// Add custom options
p.option('--allowed-domains <domains>', 'Comma-separated list of allowed domains. Navigation and actions on other domains will be blocked.', commaSeparatedList);

// Override the action handler to use our custom server
p.action(async (options) => {
  options.sandbox = options.sandbox === true ? undefined : false;

  // Resolve allowed domains from CLI option or ALLOWED_DOMAINS env var
  let allowedDomains = options.allowedDomains || null;
  if (!allowedDomains && process.env.ALLOWED_DOMAINS) {
    allowedDomains = process.env.ALLOWED_DOMAINS.split(',').map(d => d.trim()).filter(Boolean);
  }
  if (allowedDomains && allowedDomains.length > 0) {
    console.error(`Domain enforcement enabled. Allowed domains: ${allowedDomains.join(', ')}`);
  }

  await startCustomServer(options, packageJSON.version, allowedDomains);
});

void program.parseAsync(process.argv);
