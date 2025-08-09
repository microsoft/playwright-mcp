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

test('clipboard permissions support via CLI argument', async ({ startClient, server }) => {
  server.setContent('/', `
    <html>
      <body>
        <h1>Test Page</h1>
      </body>
    </html>
  `, 'text/html');

  const { client } = await startClient({ args: ['--permissions', 'clipboard-read,clipboard-write'] });

  // Navigate to server page
  const navigateResponse = await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });
  expect(navigateResponse.isError).toBeFalsy();

  // Verify permissions are granted
  const permissionsResponse = await client.callTool({
    name: 'browser_evaluate',
    arguments: {
      function: '() => navigator.permissions.query({ name: "clipboard-write" }).then(result => result.state)'
    }
  });
  expect(permissionsResponse.isError).toBeFalsy();
  expect(permissionsResponse).toHaveResponse({
    result: '"granted"'
  });

  // Test clipboard write operation without user permission prompt
  const writeResponse = await client.callTool({
    name: 'browser_evaluate',
    arguments: {
      function: '() => navigator.clipboard.writeText("test clipboard content")'
    }
  });
  expect(writeResponse.isError).toBeFalsy();

  // Test clipboard read operation without user permission prompt
  const readResponse = await client.callTool({
    name: 'browser_evaluate',
    arguments: {
      function: '() => navigator.clipboard.readText()'
    }
  });
  expect(readResponse.isError).toBeFalsy();
  expect(readResponse).toHaveResponse({
    result: '"test clipboard content"'
  });
});

test('clipboard permissions support via config file contextOptions', async ({ startClient, server }) => {
  server.setContent('/', `
    <html>
      <body>
        <h1>Config Test Page</h1>
      </body>
    </html>
  `, 'text/html');

  const config = {
    browser: {
      contextOptions: {
        permissions: ['clipboard-read', 'clipboard-write']
      }
    }
  };

  const { client } = await startClient({ config });

  // Navigate to server page
  const navigateResponse = await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });
  expect(navigateResponse.isError).toBeFalsy();

  // Verify permissions are granted via config
  const permissionsResponse = await client.callTool({
    name: 'browser_evaluate',
    arguments: {
      function: '() => navigator.permissions.query({ name: "clipboard-write" }).then(result => result.state)'
    }
  });
  expect(permissionsResponse.isError).toBeFalsy();
  expect(permissionsResponse).toHaveResponse({
    result: '"granted"'
  });

  // Test clipboard operations work with config file
  const writeResponse = await client.callTool({
    name: 'browser_evaluate',
    arguments: {
      function: '() => navigator.clipboard.writeText("config test content")'
    }
  });
  expect(writeResponse.isError).toBeFalsy();

  const readResponse = await client.callTool({
    name: 'browser_evaluate',
    arguments: {
      function: '() => navigator.clipboard.readText()'
    }
  });
  expect(readResponse.isError).toBeFalsy();
  expect(readResponse).toHaveResponse({
    result: '"config test content"'
  });
});

test('multiple permissions can be granted', async ({ startClient, server }) => {
  server.setContent('/', `
    <html>
      <body>
        <h1>Multiple Permissions Test</h1>
      </body>
    </html>
  `, 'text/html');

  const { client } = await startClient({ args: ['--permissions', 'clipboard-read,clipboard-write,geolocation'] });

  // Navigate to server page
  const navigateResponse = await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });
  expect(navigateResponse.isError).toBeFalsy();

  // Test that multiple permissions can be granted
  const clipboardPermissionResponse = await client.callTool({
    name: 'browser_evaluate',
    arguments: {
      function: '() => navigator.permissions.query({ name: "clipboard-write" }).then(result => result.state)'
    }
  });
  expect(clipboardPermissionResponse.isError).toBeFalsy();
  expect(clipboardPermissionResponse).toHaveResponse({
    result: '"granted"'
  });

  const geolocationPermissionResponse = await client.callTool({
    name: 'browser_evaluate',
    arguments: {
      function: '() => navigator.permissions.query({ name: "geolocation" }).then(result => result.state)'
    }
  });
  expect(geolocationPermissionResponse.isError).toBeFalsy();
  expect(geolocationPermissionResponse).toHaveResponse({
    result: '"granted"'
  });
});
