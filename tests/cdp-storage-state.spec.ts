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

import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { test, expect } from './fixtures.js';

test.describe('CDP with storage state', () => {
  test.skip(({ mcpMode }) => mcpMode === 'docker', 'CDP tests are not supported in docker mode');

  test('should apply storage state in isolated mode', async ({ createClient, server }) => {
    const storageStatePath = path.join(os.tmpdir(), `storage-state-${Date.now()}.json`);

    // Create a storage state file
    const storageState = {
      cookies: [
        {
          name: 'test-cookie',
          value: 'test-value',
          domain: new URL(server.PREFIX).hostname,
          path: '/',
          expires: Date.now() / 1000 + 3600,
          httpOnly: false,
          secure: false,
          sameSite: 'Lax'
        }
      ],
      origins: []
    };

    await fs.writeFile(storageStatePath, JSON.stringify(storageState));

    try {
      // Create a client with CDP endpoint and storage state
      const client = await createClient({
        browser: {
          cdpEndpoint: process.env.TEST_CDP_ENDPOINT || 'ws://localhost:9222',
          isolated: true,
          contextOptions: {
            storageState: storageStatePath
          }
        }
      });

      server.setContent('/', `
        <title>Storage State Test</title>
        <div id="cookie-value"></div>
        <script>
          document.getElementById('cookie-value').textContent = 
            document.cookie || 'no-cookies';
        </script>
      `, 'text/html');

      await client.callTool({
        name: 'browser_navigate',
        arguments: { url: server.PREFIX },
      });

      const snapshot = await client.callTool({
        name: 'browser_snapshot',
        arguments: {},
      });

      // Check if cookie was applied
      expect(snapshot.response.pageState).toContain('test-cookie=test-value');

      await client.close();
    } finally {
      await fs.unlink(storageStatePath).catch(() => {});
    }
  });

  test('should handle storage state with localStorage', async ({ createClient, server }) => {
    const storageStatePath = path.join(os.tmpdir(), `storage-state-ls-${Date.now()}.json`);

    // Create a storage state file with localStorage
    const storageState = {
      cookies: [],
      origins: [
        {
          origin: server.PREFIX,
          localStorage: [
            { name: 'test-key', value: 'test-value' }
          ]
        }
      ]
    };

    await fs.writeFile(storageStatePath, JSON.stringify(storageState));

    try {
      const client = await createClient({
        browser: {
          cdpEndpoint: process.env.TEST_CDP_ENDPOINT || 'ws://localhost:9222',
          isolated: true,
          contextOptions: {
            storageState: storageStatePath
          }
        }
      });

      server.setContent('/', `
        <title>LocalStorage Test</title>
        <div id="storage-value"></div>
        <script>
          document.getElementById('storage-value').textContent = 
            localStorage.getItem('test-key') || 'no-value';
        </script>
      `, 'text/html');

      await client.callTool({
        name: 'browser_navigate',
        arguments: { url: server.PREFIX },
      });

      const snapshot = await client.callTool({
        name: 'browser_snapshot',
        arguments: {},
      });

      // Check if localStorage was applied
      expect(snapshot.response.pageState).toContain('test-value');

      await client.close();
    } finally {
      await fs.unlink(storageStatePath).catch(() => {});
    }
  });
});
