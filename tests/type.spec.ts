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

test('browser_type', async ({ client, server }) => {
  server.setContent('/', `
    <!DOCTYPE html>
    <html>
      <input type='keypress' onkeypress="console.log('Key pressed:', event.key, ', Text:', event.target.value)"></input>
    </html>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: {
      url: server.PREFIX,
    },
  });

  {
    const response = await client.callTool({
      name: 'browser_type',
      arguments: {
        element: 'textbox',
        ref: 'e2',
        text: 'Hi!',
        submit: true,
      },
    });
    expect(response).toContainTextContent(`fill('Hi!');`);
    expect(response).toContainTextContent(`- textbox`);
  }

  expect(await client.callTool({
    name: 'browser_console_messages',
  })).toHaveTextContent(/\[LOG\] Key pressed: Enter , Text: Hi!/);
});

test('browser_type (slowly)', async ({ client, server }) => {
  server.setContent('/', `
    <input type='text' onkeydown="console.log('Key pressed:', event.key, 'Text:', event.target.value)"></input>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: {
      url: server.PREFIX,
    },
  });
  {
    const response = await client.callTool({
      name: 'browser_type',
      arguments: {
        element: 'textbox',
        ref: 'e2',
        text: 'Hi!',
        slowly: true,
      },
    });

    expect(response).toContainTextContent(`pressSequentially('Hi!');`);
    expect(response).toContainTextContent(`- textbox`);
  }
  const response = await client.callTool({
    name: 'browser_console_messages',
  });
  expect(response).toHaveTextContent(/\[LOG\] Key pressed: H Text: /);
  expect(response).toHaveTextContent(/\[LOG\] Key pressed: i Text: H/);
  expect(response).toHaveTextContent(/\[LOG\] Key pressed: ! Text: Hi/);
});

test('browser_type (no submit)', async ({ client, server }) => {
  server.setContent('/', `
    <input type='text' oninput="console.log('New value: ' + event.target.value)"></input>
  `, 'text/html');

  {
    const response = await client.callTool({
      name: 'browser_navigate',
      arguments: {
        url: server.PREFIX,
      },
    });
    expect(response).toContainTextContent(`- textbox`);
  }
  {
    const response = await client.callTool({
      name: 'browser_type',
      arguments: {
        element: 'textbox',
        ref: 'e2',
        text: 'Hi!',
      },
    });
    expect(response).toContainTextContent(`fill('Hi!');`);
    // Should yield no snapshot.
    expect(response).not.toContainTextContent(`- textbox`);
  }
  {
    const response = await client.callTool({
      name: 'browser_console_messages',
    });
    expect(response).toHaveTextContent(/\[LOG\] New value: Hi!/);
  }
});
