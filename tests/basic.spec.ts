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

test('test tool list', async ({ client, visionClient }) => {
  const { tools } = await client.listTools();
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
    'browser_install',
  ]);

  const { tools: visionTools } = await visionClient.listTools();
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
    'browser_install',
  ]);
});

test('test resources list', async ({ client }) => {
  const { resources } = await client.listResources();
  expect(resources).toEqual([
    expect.objectContaining({
      uri: 'browser://console',
      mimeType: 'text/plain',
    }),
  ]);
});

test('test browser_navigate', async ({ client }) => {
  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: {
      url: 'data:text/html,<html><title>Title</title><body>Hello, world!</body></html>',
    },
  })).toHaveTextContent(`
- Page URL: data:text/html,<html><title>Title</title><body>Hello, world!</body></html>
- Page Title: Title
- Page Snapshot
\`\`\`yaml
- document [ref=s1e2]: Hello, world!
\`\`\`
`
  );
});

test('test browser_click', async ({ client }) => {
  await client.callTool({
    name: 'browser_navigate',
    arguments: {
      url: 'data:text/html,<html><title>Title</title><button>Submit</button></html>',
    },
  });

  expect(await client.callTool({
    name: 'browser_click',
    arguments: {
      element: 'Submit button',
      ref: 's1e4',
    },
  })).toHaveTextContent(`"Submit button" clicked

- Page URL: data:text/html,<html><title>Title</title><button>Submit</button></html>
- Page Title: Title
- Page Snapshot
\`\`\`yaml
- document [ref=s2e2]:
  - button "Submit" [ref=s2e4]
\`\`\`
`);
});

test('test reopen browser', async ({ client }) => {
  await client.callTool({
    name: 'browser_navigate',
    arguments: {
      url: 'data:text/html,<html><title>Title</title><body>Hello, world!</body></html>',
    },
  });

  expect(await client.callTool({
    name: 'browser_close',
  })).toHaveTextContent('Page closed');

  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: {
      url: 'data:text/html,<html><title>Title</title><body>Hello, world!</body></html>',
    },
  })).toHaveTextContent(`
- Page URL: data:text/html,<html><title>Title</title><body>Hello, world!</body></html>
- Page Title: Title
- Page Snapshot
\`\`\`yaml
- document [ref=s1e2]: Hello, world!
\`\`\`
`);
});

test('single option', async ({ client }) => {
  await client.callTool({
    name: 'browser_navigate',
    arguments: {
      url: 'data:text/html,<html><title>Title</title><select><option value="foo">Foo</option><option value="bar">Bar</option></select></html>',
    },
  });

  expect(await client.callTool({
    name: 'browser_select_option',
    arguments: {
      element: 'Select',
      ref: 's1e4',
      values: ['bar'],
    },
  })).toHaveTextContent(`Selected option in "Select"

- Page URL: data:text/html,<html><title>Title</title><select><option value="foo">Foo</option><option value="bar">Bar</option></select></html>
- Page Title: Title
- Page Snapshot
\`\`\`yaml
- document [ref=s2e2]:
  - combobox [ref=s2e4]:
    - option "Foo" [ref=s2e5]
    - option "Bar" [selected] [ref=s2e6]
\`\`\`
`);
});

test('multiple option', async ({ client }) => {
  await client.callTool({
    name: 'browser_navigate',
    arguments: {
      url: 'data:text/html,<html><title>Title</title><select multiple><option value="foo">Foo</option><option value="bar">Bar</option><option value="baz">Baz</option></select></html>',
    },
  });

  expect(await client.callTool({
    name: 'browser_select_option',
    arguments: {
      element: 'Select',
      ref: 's1e4',
      values: ['bar', 'baz'],
    },
  })).toHaveTextContent(`Selected option in "Select"

- Page URL: data:text/html,<html><title>Title</title><select multiple><option value="foo">Foo</option><option value="bar">Bar</option><option value="baz">Baz</option></select></html>
- Page Title: Title
- Page Snapshot
\`\`\`yaml
- document [ref=s2e2]:
  - listbox [ref=s2e4]:
    - option "Foo" [ref=s2e5]
    - option "Bar" [selected] [ref=s2e6]
    - option "Baz" [selected] [ref=s2e7]
\`\`\`
`);
});

test('browser://console', async ({ client }) => {
  await client.callTool({
    name: 'browser_navigate',
    arguments: {
      url: 'data:text/html,<html><script>console.log("Hello, world!");console.error("Error"); </script></html>',
    },
  });

  const resource = await client.readResource({
    uri: 'browser://console',
  });
  expect(resource.contents).toEqual([{
    uri: 'browser://console',
    mimeType: 'text/plain',
    text: '[LOG] Hello, world!\n[ERROR] Error',
  }]);
});

test('stitched aria frames', async ({ client }) => {
  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: {
      url: 'data:text/html,<h1>Hello</h1><iframe src="data:text/html,<h1>World</h1>"></iframe><iframe src="data:text/html,<h1>Should be invisible</h1>" style="display: none;"></iframe>',
    },
  })).toHaveTextContent(`
- Page URL: data:text/html,<h1>Hello</h1><iframe src="data:text/html,<h1>World</h1>"></iframe><iframe src="data:text/html,<h1>Should be invisible</h1>" style="display: none;"></iframe>
- Page Title: 
- Page Snapshot
\`\`\`yaml
- document [ref=s1e2]:
  - heading "Hello" [level=1] [ref=s1e4]

# iframe src=data:text/html,<h1>World</h1>
- document [ref=f0s1e2]:
  - heading "World" [level=1] [ref=f0s1e4]
\`\`\`
`);
});

test('browser_choose_file', async ({ client }) => {
  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: {
      url: 'data:text/html,<html><title>Title</title><input type="file" /><button>Button</button></html>',
    },
  })).toContainTextContent('- textbox [ref=s1e4]');

  expect(await client.callTool({
    name: 'browser_click',
    arguments: {
      element: 'Textbox',
      ref: 's1e4',
    },
  })).toContainTextContent('There is a file chooser visible that requires browser_choose_file to be called');

  const filePath = test.info().outputPath('test.txt');
  await fs.writeFile(filePath, 'Hello, world!');

  {
    const response = await client.callTool({
      name: 'browser_choose_file',
      arguments: {
        paths: [filePath],
      },
    });

    expect(response).not.toContainTextContent('There is a file chooser visible that requires browser_choose_file to be called');
    expect(response).toContainTextContent('textbox [ref=s3e4]: C:\\fakepath\\test.txt');
  }

  {
    const response = await client.callTool({
      name: 'browser_click',
      arguments: {
        element: 'Textbox',
        ref: 's3e4',
      },
    });

    expect(response).toContainTextContent('There is a file chooser visible that requires browser_choose_file to be called');
    expect(response).toContainTextContent('button "Button" [ref=s4e5]');
  }

  {
    const response = await client.callTool({
      name: 'browser_click',
      arguments: {
        element: 'Button',
        ref: 's4e5',
      },
    });

    expect(response, 'not submitting browser_choose_file dismisses file chooser').not.toContainTextContent('There is a file chooser visible that requires browser_choose_file to be called');
  }
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

test('cdp server', async ({ cdpEndpoint, startClient }) => {
  const client = await startClient({ args: [`--cdp-endpoint=${cdpEndpoint}`] });
  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: {
      url: 'data:text/html,<html><title>Title</title><body>Hello, world!</body></html>',
    },
  })).toHaveTextContent(`
- Page URL: data:text/html,<html><title>Title</title><body>Hello, world!</body></html>
- Page Title: Title
- Page Snapshot
\`\`\`yaml
- document [ref=s1e2]: Hello, world!
\`\`\`
`
  );
});

test('save as pdf', async ({ client }) => {
  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: {
      url: 'data:text/html,<html><title>Title</title><body>Hello, world!</body></html>',
    },
  })).toHaveTextContent(`
- Page URL: data:text/html,<html><title>Title</title><body>Hello, world!</body></html>
- Page Title: Title
- Page Snapshot
\`\`\`yaml
- document [ref=s1e2]: Hello, world!
\`\`\`
`
  );

  const response = await client.callTool({
    name: 'browser_save_as_pdf',
  });
  expect(response).toHaveTextContent(/^Saved as.*page-[^:]+.pdf$/);
});

test('executable path', async ({ startClient }) => {
  const client = await startClient({ args: [`--executable-path=bogus`] });
  const response = await client.callTool({
    name: 'browser_navigate',
    arguments: {
      url: 'data:text/html,<html><title>Title</title><body>Hello, world!</body></html>',
    },
  });
  expect(response).toContainTextContent(`executable doesn't exist`);
});
