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

const { program } = require('playwright-core/lib/utilsBundle');
const { decorateCommand } = require('playwright/lib/mcp/program');

// Start health check server if running in Docker (production environment)
if (process.env.NODE_ENV === 'production') {
  const http = require('http');
  const HEALTH_PORT = 3000;

  const healthServer = http.createServer((req, res) => {
    if (req.url === '/up' && req.method === 'GET') {
      // Simple health check - just respond OK
      // If the process is running and can handle HTTP requests, we're healthy
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('OK');
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
    }
  });

  healthServer.listen(HEALTH_PORT, '0.0.0.0', () => {
    console.error(`Health check server listening on port ${HEALTH_PORT}`);
  });
}

const packageJSON = require('./package.json');
const p = program.version('Version ' + packageJSON.version).name('Playwright MCP');
decorateCommand(p, packageJSON.version)
void program.parseAsync(process.argv);
