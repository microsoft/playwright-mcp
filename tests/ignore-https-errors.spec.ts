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

import { test, expect } from './fixtures.js';

test('browser_ignore_https_errors tool enables HTTPS error ignoring', async ({ client, httpsServer }) => {
  // Set up a self-signed HTTPS server that would normally cause certificate errors
  httpsServer.setRoute('/test', (req, res) => {
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end('<html><body><h1>HTTPS Test Page</h1></body></html>');
  });

  // First try to navigate without ignoring HTTPS errors - this should fail
  await client.tools.browser_navigate({ url: httpsServer.url('/test') });
  
  // Now enable HTTPS error ignoring
  const ignoreResult = await client.tools.browser_ignore_https_errors({ ignore: true });
  expect(ignoreResult).toContain('Browser context recreated with HTTPS error handling disabled');

  // Now try to navigate again - this should succeed
  const navigateResult = await client.tools.browser_navigate({ url: httpsServer.url('/test') });
  expect(navigateResult).toContain('HTTPS Test Page');

  // Verify we can disable HTTPS error ignoring again
  const restoreResult = await client.tools.browser_ignore_https_errors({ ignore: false });
  expect(restoreResult).toContain('Browser context recreated with HTTPS error handling enabled');
});

test('browser_ignore_https_errors tool parameter validation', async ({ client }) => {
  // Test with valid boolean value
  const result = await client.tools.browser_ignore_https_errors({ ignore: true });
  expect(result).toContain('Browser context recreated');
  
  // Test parameter is required
  await expect(client.tools.browser_ignore_https_errors({} as any)).rejects.toThrow();
}); 