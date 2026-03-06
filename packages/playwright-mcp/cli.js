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
const mcpBundle = require('playwright-core/lib/mcpBundle');
const { decorateMCPCommand } = require('playwright/lib/mcp/program');

const packageJSON = require('./package.json');

function sanitizeString(value) {
  if (typeof value !== 'string')
    return value;
  if (typeof value.toWellFormed === 'function')
    return value.toWellFormed();

  let result = '';
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index);
    if (code >= 0xD800 && code <= 0xDBFF) {
      const next = value.charCodeAt(index + 1);
      if (next >= 0xDC00 && next <= 0xDFFF) {
        result += value[index] + value[index + 1];
        index++;
      } else {
        result += '\uFFFD';
      }
      continue;
    }
    if (code >= 0xDC00 && code <= 0xDFFF) {
      result += '\uFFFD';
      continue;
    }
    result += value[index];
  }
  return result;
}

function sanitizeDeep(value) {
  if (typeof value === 'string')
    return sanitizeString(value);
  if (Array.isArray(value))
    return value.map(sanitizeDeep);
  if (!value || typeof value !== 'object')
    return value;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null)
    return value;
  return Object.fromEntries(Object.entries(value).map(([key, nestedValue]) => [key, sanitizeDeep(nestedValue)]));
}

function patchTransportSend(Transport) {
  const originalSend = Transport?.prototype?.send;
  if (typeof originalSend !== 'function' || originalSend.__playwrightMcpUnicodeSafe)
    return;
  const wrappedSend = function(message, ...args) {
    return originalSend.call(this, sanitizeDeep(message), ...args);
  };
  wrappedSend.__playwrightMcpUnicodeSafe = true;
  Transport.prototype.send = wrappedSend;
}

function installUnicodeSafeSerialization() {
  patchTransportSend(mcpBundle.StdioServerTransport);
  patchTransportSend(mcpBundle.SSEServerTransport);
  patchTransportSend(mcpBundle.StreamableHTTPServerTransport);
}

function run() {
  installUnicodeSafeSerialization();
  const p = program.version('Version ' + packageJSON.version).name('Playwright MCP');
  decorateMCPCommand(p, packageJSON.version);
  return program.parseAsync(process.argv);
}

module.exports = {
  installUnicodeSafeSerialization,
  sanitizeDeep,
  sanitizeString,
};

if (require.main === module)
  void run();
