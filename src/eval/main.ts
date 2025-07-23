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

/* eslint-disable no-console */

import path from 'path';
import url from 'url';
import dotenv from 'dotenv';

import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { program } from 'commander';
import { runTask as runTaskOpenAI } from './loopOpenAI.js';
import { runTask as runTaskClaude } from './loopClaude.js';

dotenv.config();

const __filename = url.fileURLToPath(import.meta.url);

async function run(runTask: (client: Client, task: string) => Promise<string | undefined>) {
  const transport = new StdioClientTransport({
    command: 'node',
    args: [
      path.resolve(__filename, '../../../cli.js'),
      '--save-session',
      '--output-dir', path.resolve(__filename, '../../../sessions')
    ],
    stderr: 'inherit',
    env: process.env as Record<string, string>,
  });

  const client = new Client({ name: 'test', version: '1.0.0' });
  await client.connect(transport);
  await client.ping();

  let lastResult: string | undefined;
  for (const task of tasks)
    lastResult = await runTask(client, task);
  console.log(lastResult);
  await client.close();
}

const tasks = [
  'Open https://playwright.dev/',
];

program
    .option('--model <model>', 'model to use')
    .action(async options => {
      if (options.model === 'claude')
        await run(runTaskClaude);
      else
        await run(runTaskOpenAI);
    });
void program.parseAsync(process.argv);
