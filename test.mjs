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

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { ListRootsRequestSchema, PingRequestSchema } from '@modelcontextprotocol/sdk/types.js';

export async function connectMCP() {
  // const transport = new StreamableHTTPClientTransport(new URL('http://localhost:4242/mcp'));

  const transport = new StdioClientTransport({
    command: 'node',
    env: process.env,
    args: [
      '/Users/yurys/playwright/packages/playwright/cli.js',
      'run-mcp-server',
      '--browser=chrome-canary',
      '--extension',
      // '--browser=chromium',
      // '--no-sandbox',
      // '--isolated',
    ],
    stderr: 'inherit',
  });


  console.error('will create client');
  const client = new Client({ name: 'Visual Studio Code', version: '1.0.0' });
  client.setRequestHandler(PingRequestSchema, async () => ({}));

  console.error('Will connect');
  try {
    await client.connect(transport);
  } catch (error) {
    console.error('Connection error:', error);
  }
  console.error('Connected');

  // const tools = await client.listTools();
  // console.log('Available tools:', tools.tools.length);

  // await client.ping();
  // console.error('Pinged');

  {
    const response = await client.callTool({
      name: 'browser_navigate',
      arguments: {
        url: 'https://amazon.com/'
      }
    });
    console.log('Navigated to Amazon', response.isError ? 'error' : '', response.error ? response.error : '');
  }

  // const r = await client.callTool({
  //   name: 'browser_connect',
  //   arguments: {
  //     name: 'extension'
  //   }
  // });
  // console.log('Connected to extension', r.isError ? 'error' : '', r.content);

  const response = await client.callTool({
    name: 'browser_navigate',
    arguments: {
      url: 'https://google.com/'
    }
  });
  console.log('Navigated to Google', response.isError ? 'error' : '', response.isError ? response : '');

  if (response.isError)
    return;

  const response2 = await client.callTool({
    name: 'browser_type',
    arguments: {
      text: 'Browser MCP',
      submit: true,
      element: 'combobox "Search" [active] [ref=e44]',
      ref: 'e44',
    }
  });
  console.log('Typed text', response2.isError ? response2.content : '');

  // console.log('Closing browser...');
  // const response3 = await client.callTool({
  //   name: 'browser_close',
  //   arguments: {}
  // });
  // console.log('Closed browser');
  // console.log(response3.isError ? 'error' : '', response3.error ? response3.error : '');


  // await new Promise(resolve => setTimeout(resolve, 5_000));

  // await transport.terminateSession();
  await client.close();
  console.log('Closed MCP client');
}

void connectMCP();
