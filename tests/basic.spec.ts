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
import { spawn } from 'node:child_process';
import path from 'node:path';
import { test, expect } from './fixtures';

test('test tool list', async ({ server, visionServer }) => {
  const tools = await server.listTools();
  expect(tools.map(t => t.name)).toEqual([
    'browser_navigate',
    'browser_go_back',
    'browser_go_forward',
    'browser_choose_file',
    'browser_snapshot',
    'browser_click',
    'browser_hover',
    'browser_type',
    'browser_select_option',
    'browser_take_screenshot',
    'browser_press_key',
    'browser_wait',
    'browser_save_as_pdf',
    'browser_close',
  ]);

  const visionTools = await visionServer.listTools();
  expect(visionTools.map(t => t.name)).toEqual([
    'browser_navigate',
    'browser_go_back',
    'browser_go_forward',
    'browser_choose_file',
    'browser_screenshot',
    'browser_move_mouse',
    'browser_click',
    'browser_drag',
    'browser_type',
    'browser_press_key',
    'browser_wait',
    'browser_save_as_pdf',
    'browser_close',
  ]);
});

test('test resources list', async ({ server }) => {
  expect(await server.listResources()).toEqual([
    expect.objectContaining({
      uri: 'browser://console',
      mimeType: 'text/plain',
    }),
  ]);
});

test('test browser_navigate', async ({ server }) => {
  expect(await server.callTool('browser_navigate', { url: 'data:text/html,<html><title>Title</title><body>Hello, world!</body></html>' })).toEqual([
    `
- Page URL: data:text/html,<html><title>Title</title><body>Hello, world!</body></html>
- Page Title: Title
- Page Snapshot
\`\`\`yaml
- document [ref=s1e2]: Hello, world!
\`\`\`
`
  ]);
});

test('test browser_click', async ({ server }) => {
  await server.callTool(
      'browser_navigate',
      { url: 'data:text/html,<html><title>Title</title><button>Submit</button></html>' }
  );

  expect(await server.callTool('browser_click', { element: 'Submit button', ref: 's1e4' })).toEqual([
    `\"Submit button\" clicked

- Page URL: data:text/html,<html><title>Title</title><button>Submit</button></html>
- Page Title: Title
- Page Snapshot
\`\`\`yaml
- document [ref=s2e2]:
  - button \"Submit\" [ref=s2e4]
\`\`\`
`]);
});

test('test reopen browser', async ({ server }) => {
  await server.callTool(
      'browser_navigate',
      { url: 'data:text/html,<html><title>Title</title><body>Hello, world!</body></html>' }
  );

  expect(await server.callTool('browser_close')).toEqual(['Page closed']);

  expect(await server.callTool('browser_navigate', { url: 'data:text/html,<html><title>Title</title><body>Hello, world!</body></html>' })).toEqual([`
- Page URL: data:text/html,<html><title>Title</title><body>Hello, world!</body></html>
- Page Title: Title
- Page Snapshot
\`\`\`yaml
- document [ref=s1e2]: Hello, world!
\`\`\`
`,]);
});

test.describe('test browser_select_option', () => {
  test('single option', async ({ server }) => {
    await server.callTool('browser_navigate', {
      url: 'data:text/html,<html><title>Title</title><select><option value="foo">Foo</option><option value="bar">Bar</option></select></html>',
    });

    const response = await server.callTool('browser_select_option', { element: 'Select', ref: 's1e4', values: ['bar'] });

    expect(response).toEqual([
      `Selected option in \"Select\"

- Page URL: data:text/html,<html><title>Title</title><select><option value="foo">Foo</option><option value="bar">Bar</option></select></html>
- Page Title: Title
- Page Snapshot
\`\`\`yaml
- document [ref=s2e2]:
  - combobox [ref=s2e4]:
    - option \"Foo\" [ref=s2e5]
    - option \"Bar\" [selected] [ref=s2e6]
\`\`\`
`]);
  });

  test('multiple option', async ({ server }) => {
    await server.callTool('browser_navigate', {
      url: 'data:text/html,<html><title>Title</title><select multiple><option value="foo">Foo</option><option value="bar">Bar</option><option value="baz">Baz</option></select></html>',
    });

    const response = await server.callTool('browser_select_option', { element: 'Select', ref: 's1e4', values: ['bar', 'baz'] });

    expect(response).toEqual([
      `Selected option in \"Select\"

- Page URL: data:text/html,<html><title>Title</title><select multiple><option value="foo">Foo</option><option value="bar">Bar</option><option value="baz">Baz</option></select></html>
- Page Title: Title
- Page Snapshot
\`\`\`yaml
- document [ref=s2e2]:
  - listbox [ref=s2e4]:
    - option \"Foo\" [ref=s2e5]
    - option \"Bar\" [selected] [ref=s2e6]
    - option \"Baz\" [selected] [ref=s2e7]
\`\`\`
`]);
  });
});

test('browser://console', async ({ server }) => {
  await server.callTool('browser_navigate', {
    url: 'data:text/html,<html><script>console.log("Hello, world!");console.error("Error"); </script></html>',
  });
  expect(await server.readResource('browser://console')).toEqual([{
    uri: 'browser://console',
    mimeType: 'text/plain',
    text: '[LOG] Hello, world!\n[ERROR] Error',
  }]);
});

test('stitched aria frames', async ({ server }) => {
  const response = await server.callTool('browser_navigate', {
    url: 'data:text/html,<h1>Hello</h1><iframe src="data:text/html,<h1>World</h1>"></iframe><iframe src="data:text/html,<h1>Should be invisible</h1>" style="display: none;"></iframe>',
  });

  expect(response).toEqual([`
- Page URL: data:text/html,<h1>Hello</h1><iframe src="data:text/html,<h1>World</h1>"></iframe><iframe src="data:text/html,<h1>Should be invisible</h1>" style="display: none;"></iframe>
- Page Title: 
- Page Snapshot
\`\`\`yaml
- document [ref=s1e2]:
  - heading \"Hello\" [level=1] [ref=s1e4]

# iframe src=data:text/html,<h1>World</h1>
- document [ref=f0s1e2]:
  - heading \"World\" [level=1] [ref=f0s1e4]
\`\`\`
`
  ]);
});

test('browser_choose_file', async ({ server }) => {
  let response = await server.callTool('browser_navigate', {
    url: 'data:text/html,<html><title>Title</title><input type="file" /><button>Button</button></html>',
  });

  expect(response[0]).toContain('- textbox [ref=s1e4]');

  response = await server.callTool('browser_click', {
    element: 'Textbox',
    ref: 's1e4',
  });

  expect(response[0]).toContain('There is a file chooser visible that requires browser_choose_file to be called');

  const filePath = test.info().outputPath('test.txt');
  await fs.writeFile(filePath, 'Hello, world!');
  response = await server.callTool('browser_choose_file', {
    paths: [filePath],
  });

  expect(response[0]).not.toContain('There is a file chooser visible that requires browser_choose_file to be called');
  expect(response[0]).toContain('textbox [ref=s3e4]: C:\\fakepath\\test.txt');

  response = await server.callTool('browser_click', {
    element: 'Textbox',
    ref: 's3e4',
  });

  expect(response[0]).toContain('There is a file chooser visible that requires browser_choose_file to be called');
  expect(response[0]).toContain('button "Button" [ref=s4e5]');

  response = await server.callTool('browser_click', {
    element: 'Button',
    ref: 's4e5',
  });

  expect(response[0], 'not submitting browser_choose_file dismisses file chooser').not.toContain('There is a file chooser visible that requires browser_choose_file to be called');
});

test('sse transport', async () => {
  const cp = spawn('node', [path.join(__dirname, '../cli.js'), '--port', '0'], { stdio: 'pipe' });
  try {
    let stdout = '';
    const url = await new Promise<string>(resolve => cp.stdout?.on('data', data => {
      stdout += data.toString();
      const match = stdout.match(/Listening on (http:\/\/.*)/);
      if (match)
        resolve(match[1]);
    }));

    // need dynamic import b/c of some ESM nonsense
    const { SSEClientTransport } = await import('@modelcontextprotocol/sdk/client/sse.js');
    const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
    const transport = new SSEClientTransport(new URL(url));
    const client = new Client({ name: 'test', version: '1.0.0' });
    await client.connect(transport);
    await client.ping();
  } finally {
    cp.kill();
  }
});
