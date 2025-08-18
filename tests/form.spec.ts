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

test('browser_fill_form - basic text inputs', async ({ client, server }) => {
  server.setContent('/', `
    <!DOCTYPE html>
    <html>
      <body>
        <form>
          <input type="text" name="username" placeholder="Username" />
          <input type="email" name="email" placeholder="Email" />
          <button type="submit">Submit</button>
        </form>
      </body>
    </html>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  const response = await client.callTool({
    name: 'browser_fill_form',
    arguments: {
      fields: [
        {
          ref: 'e3',
          element: 'Username textbox',
          value: 'john_doe',
          type: 'text'
        },
        {
          ref: 'e4', 
          element: 'Email textbox',
          value: 'john@example.com',
          type: 'text'
        }
      ]
    },
  });

  expect(response).toHaveResponse({
    code: expect.stringContaining(`fill('john_doe')`),
    code: expect.stringContaining(`fill('john@example.com')`),
    code: expect.stringContaining('Form filling completed: 2/2 successful'),
  });
});

test('browser_fill_form - checkboxes', async ({ client, server }) => {
  server.setContent('/', `
    <!DOCTYPE html>
    <html>
      <body>
        <form>
          <input type="checkbox" id="newsletter" name="newsletter" />
          <label for="newsletter">Subscribe to newsletter</label>
          
          <input type="checkbox" id="terms" name="terms" checked />
          <label for="terms">I agree to terms</label>
          
          <button type="submit">Submit</button>
        </form>
      </body>
    </html>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  const response = await client.callTool({
    name: 'browser_fill_form',
    arguments: {
      fields: [
        {
          ref: 'e3',
          element: 'Newsletter checkbox',
          actions: [
            {
              type: 'check',
              description: 'Check newsletter subscription'
            }
          ]
        },
        {
          ref: 'e5',
          element: 'Terms checkbox',
          actions: [
            {
              type: 'uncheck',
              description: 'Uncheck terms agreement'
            }
          ]
        }
      ]
    },
  });

  expect(response).toHaveResponse({
    code: expect.stringContaining(`.check()`),
    code: expect.stringContaining(`.uncheck()`),
    code: expect.stringContaining('Form filling completed: 2/2 successful'),
  });
});

test('browser_fill_form - dropdowns', async ({ client, server }) => {
  server.setContent('/', `
    <!DOCTYPE html>
    <html>
      <body>
        <form>
          <select name="country">
            <option value="">Select country</option>
            <option value="us">United States</option>
            <option value="uk">United Kingdom</option>
          </select>
          
          <button type="submit">Submit</button>
        </form>
      </body>
    </html>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  const response = await client.callTool({
    name: 'browser_fill_form',
    arguments: {
      fields: [
        {
          ref: 'e3',
          element: 'Country dropdown',
          actions: [
            {
              type: 'select_by_value',
              value: 'us',
              description: 'Select US'
            }
          ]
        }
      ]
    },
  });

  expect(response).toHaveResponse({
    code: expect.stringContaining(`selectOption('us')`),
    code: expect.stringContaining('Form filling completed: 1/1 successful'),
  });
});

test('browser_fill_form - mixed legacy and action formats', async ({ client, server }) => {
  server.setContent('/', `
    <!DOCTYPE html>
    <html>
      <body>
        <form>
          <input type="text" name="name" placeholder="Name" />
          <select name="role">
            <option value="">Select role</option>
            <option value="admin">Admin</option>
            <option value="user">User</option>
          </select>
          <button type="submit">Create</button>
        </form>
      </body>
    </html>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  const response = await client.callTool({
    name: 'browser_fill_form',
    arguments: {
      fields: [
        {
          ref: 'e3',
          element: 'Name textbox',
          type: 'text',
          value: 'John Smith'
        },
        {
          ref: 'e4',
          element: 'Role dropdown',
          actions: [
            {
              type: 'select_by_value',
              value: 'admin',
              description: 'Select admin role'
            }
          ]
        }
      ]
    },
  });

  expect(response).toHaveResponse({
    code: expect.stringContaining(`fill('John Smith')`),
    code: expect.stringContaining(`selectOption('admin')`),
    code: expect.stringContaining('Form filling completed: 2/2 successful'),
  });
});

test('browser_fill_form - error handling', async ({ client, server }) => {
  server.setContent('/', `
    <!DOCTYPE html>
    <html>
      <body>
        <form>
          <input type="text" name="valid" placeholder="Valid field" />
          <button type="submit">Submit</button>
        </form>
      </body>
    </html>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  const response = await client.callTool({
    name: 'browser_fill_form',
    arguments: {
      fields: [
        {
          ref: 'e3',
          element: 'Valid field textbox',
          type: 'text',
          value: 'Valid input'
        },
        {
          ref: 'e999',
          element: 'Non-existent field',
          type: 'text',
          value: 'Invalid input'
        }
      ]
    },
  });

  expect(response).toHaveResponse({
    code: expect.stringContaining(`fill('Valid input')`),
    code: expect.stringContaining('1 fields failed'),
  });
});
