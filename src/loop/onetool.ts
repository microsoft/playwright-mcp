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

import path from 'path';
import url from 'url';
import dotenv from 'dotenv';
import { z } from 'zod';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

import { FullConfig } from '../config.js';
import { defineTool } from '../tools/tool.js';
import { Server } from '../server.js';
import { startHttpServer, startHttpTransport, startStdioTransport } from '../transport.js';
import { OpenAIDelegate } from './loopOpenAI.js';
import { runTask } from './loop.js';

dotenv.config();

const __filename = url.fileURLToPath(import.meta.url);

let innerClient: Client | undefined;
const delegate = new OpenAIDelegate();

const oneTool = defineTool({
  capability: 'core',

  schema: {
    name: 'browser',
    title: 'Perform a task with the browser',
    description: 'Perform a task with the browser. It can click, type, export, capture screenshot, drag, hover, select options, etc.',
    inputSchema: z.object({
      task: z.string().describe('The task to perform with the browser'),
    }),
    type: 'readOnly',
  },

  handle: async (context, params, response) => {
    const result = await runTask(delegate!, innerClient!, params.task);
    response.addResult(result);
  },
});

export async function runOneTool(config: FullConfig) {
  innerClient = await createInnerClient();
  const server = new Server(config, [oneTool]);
  server.setupExitWatchdog();

  if (config.server.port !== undefined) {
    const httpServer = await startHttpServer(config.server);
    startHttpTransport(httpServer, server);
  } else {
    await startStdioTransport(server);
  }
}

async function createInnerClient(): Promise<Client> {
  const transport = new StdioClientTransport({
    command: 'node',
    args: [
      path.resolve(__filename, '../../../cli.js'),
    ],
    stderr: 'inherit',
    env: process.env as Record<string, string>,
  });

  const client = new Client({ name: 'Playwright Proxy', version: '1.0.0' });
  await client.connect(transport);
  await client.ping();
  return client;
}
