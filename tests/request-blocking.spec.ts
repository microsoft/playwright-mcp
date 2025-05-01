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

import { test as _test, expect } from './fixtures.ts';

const test = _test.extend<{ fetchPage: (url: string, config?: { allowlist?: string, blocklist?: string }) => Promise<string> }>({
  fetchPage: async ({ server, startClient }, use) => {
    server.route('/ppp', (_req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('content:PPP');
    });

    server.route('/www', (_req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('content:WWW');
    });

    await use(async (url, config = {}) => {
      const args: string[] = [];
      if (config?.allowlist)
        args.push('--request-pattern-allowlist', config.allowlist);

      if (config?.blocklist)
        args.push('--request-pattern-blocklist', config.blocklist);

      const client = await startClient({
        args,
      });

      const result = await client.callTool({
        name: 'browser_navigate',
        arguments: {
          url,
        },
      });

      return JSON.stringify(result, null, 2);
    });
  },
});

const BLOCK_MESSAGE = /Blocked by Web Inspector|NS_ERROR_FAILURE|net::ERR_BLOCKED_BY_CLIENT/g;

test('default to allow all', async ({ fetchPage, server }) => {
  const result = await fetchPage(server.PREFIX + '/ppp');
  expect(result).toContain('content:PPP');
});

test('blocklist works', async ({ fetchPage, server }) => {
  const config = { blocklist: server.PREFIX + '/ppp' };
  const result = await fetchPage(server.PREFIX + '/ppp', config);
  expect(result).toMatch(BLOCK_MESSAGE);
});

test('allowlist works', async ({ fetchPage, server }) => {
  const result = await fetchPage(server.PREFIX + '/ppp', { allowlist: `https://example.com/,${server.PREFIX}/ppp,https://playwright.dev/` });
  expect(result).toContain('content:PPP');
});

test('blocklist takes precedence', async ({ fetchPage, server }) => {
  const result = await fetchPage(server.PREFIX + '/ppp', { blocklist: `https://example.com/,${server.PREFIX}/ppp,https://playwright.dev/` });
  expect(result).toMatch(BLOCK_MESSAGE);
});

test('allowlist without blocklist denies all non-explicitly specified requests', async ({ fetchPage, server }) => {
  const result = await fetchPage(server.PREFIX + '/ppp', { allowlist: server.PREFIX + '/www' });
  expect(result).toMatch(BLOCK_MESSAGE);
});

test('blocklist without allowlist allows non-explicitly specified request', async ({ fetchPage, server }) => {
  const result = await fetchPage(server.PREFIX + '/ppp', { blocklist: server.PREFIX + '/www' });
  expect(result).toContain('content:PPP');
});
