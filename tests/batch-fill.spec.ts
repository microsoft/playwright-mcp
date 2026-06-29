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

import { test, expect } from './fixtures';

test('browser_fill_form_batch - flat actions fill multiple fields in parallel', async ({ client, server }) => {
  server.setContent('/', `
    <title>Registration Form</title>
    <form>
      <input id="firstName" type="text" placeholder="First Name" />
      <input id="lastName" type="text" placeholder="Last Name" />
      <input id="email" type="email" placeholder="Email" />
      <input id="phone" type="tel" placeholder="Phone" />
    </form>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  const result = await client.callTool({
    name: 'browser_fill_form_batch',
    arguments: {
      actions: [
        { selector: '#firstName', value: 'John' },
        { selector: '#lastName', value: 'Doe' },
        { selector: '#email', value: 'john.doe@example.com' },
        { selector: '#phone', value: '5551234567' },
      ],
    },
  });

  expect(result).toHaveResponse({
    result: expect.stringContaining('4 field(s) filled successfully'),
  });

  // Verify values were actually set
  const verifyResult = await client.callTool({
    name: 'browser_evaluate',
    arguments: {
      function: `() => JSON.stringify({
        firstName: document.querySelector('#firstName').value,
        lastName: document.querySelector('#lastName').value,
        email: document.querySelector('#email').value,
        phone: document.querySelector('#phone').value,
      })`,
    },
  });

  // browser_evaluate returns JSON-stringified result with extra escaping
  const resultText = (verifyResult as any).content[0].text;
  expect(resultText).toContain('firstName');
  expect(resultText).toContain('John');
  expect(resultText).toContain('Doe');
  expect(resultText).toContain('john.doe@example.com');
  expect(resultText).toContain('5551234567');
});

test('browser_fill_form_batch - mixed field types (text, checkbox, select)', async ({ client, server }) => {
  server.setContent('/', `
    <title>Mixed Form</title>
    <form>
      <input id="name" type="text" placeholder="Name" />
      <input id="newsletter" type="checkbox" />
      <select id="country">
        <option value="">Select country</option>
        <option value="us">United States</option>
        <option value="uk">United Kingdom</option>
        <option value="in">India</option>
      </select>
    </form>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  const result = await client.callTool({
    name: 'browser_fill_form_batch',
    arguments: {
      actions: [
        { selector: '#name', value: 'Jane Smith', type: 'fill' },
        { selector: '#newsletter', value: 'true', type: 'check' },
        { selector: '#country', value: 'India', type: 'select' },
      ],
    },
  });

  expect(result).toHaveResponse({
    result: expect.stringContaining('3 field(s) filled successfully'),
  });

  // Verify checkbox and select
  const verifyResult = await client.callTool({
    name: 'browser_evaluate',
    arguments: {
      function: `() => JSON.stringify({
        name: document.querySelector('#name').value,
        newsletter: document.querySelector('#newsletter').checked,
        country: document.querySelector('#country').value,
      })`,
    },
  });

  const resultText = (verifyResult as any).content[0].text;
  expect(resultText).toContain('Jane Smith');
  expect(resultText).toContain('true');
  expect(resultText).toContain('in');
});

test('browser_fill_form_batch - dependency groups with delay', async ({ client, server }) => {
  // Simulate a dynamic form: selecting country reveals state dropdown
  server.setContent('/', `
    <title>Dynamic Form</title>
    <form>
      <select id="country">
        <option value="">Select country</option>
        <option value="us">United States</option>
      </select>
      <select id="state" style="display:none">
        <option value="">Select state</option>
        <option value="ny">New York</option>
        <option value="ca">California</option>
      </select>
      <input id="city" type="text" style="display:none" placeholder="City" />
    </form>
    <script>
      document.querySelector('#country').addEventListener('change', (e) => {
        if (e.target.value) {
          document.querySelector('#state').style.display = 'block';
          document.querySelector('#city').style.display = 'block';
        }
      });
    </script>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  const result = await client.callTool({
    name: 'browser_fill_form_batch',
    arguments: {
      groups: {
        'batch1': [
          { selector: '#country', value: 'United States', type: 'select' },
        ],
        'batch2': [
          { selector: '#state', value: 'New York', type: 'select' },
          { selector: '#city', value: 'Brooklyn', type: 'fill' },
        ],
      },
      delayBetweenGroups: 300,
    },
  });

  expect(result).toHaveResponse({
    result: expect.stringContaining('3 field(s) filled successfully'),
  });
});

test('browser_fill_form_batch - graceful error on invalid selector', async ({ client, server }) => {
  server.setContent('/', `
    <title>Error Test Form</title>
    <form>
      <input id="real" type="text" />
    </form>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  const result = await client.callTool({
    name: 'browser_fill_form_batch',
    arguments: {
      actions: [
        { selector: '#real', value: 'works' },
        { selector: '#nonexistent', value: 'fails' },
      ],
    },
  });

  // Should report partial success — one filled, one failed
  expect(result).toHaveResponse({
    result: expect.stringContaining('1 field(s) filled successfully'),
  });
  expect(result).toHaveResponse({
    result: expect.stringContaining('1 field(s) failed'),
  });
});

test('browser_fill_form_batch - empty actions returns error message', async ({ client, server }) => {
  server.setContent('/', `<title>Empty Test</title><form></form>`, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  const result = await client.callTool({
    name: 'browser_fill_form_batch',
    arguments: {
      actions: [],
    },
  });

  expect(result).toHaveResponse({
    result: expect.stringContaining('Provide either'),
  });
});
