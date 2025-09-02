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
import dotenv from 'dotenv';
import { program } from 'commander';

import * as mcpBundle from '../mcp/bundle.js';
import { OpenAIDelegate } from './loopOpenAI';
import { ClaudeDelegate } from './loopClaude';
import { runTask } from './loop';

import type { LLMDelegate } from './loop';

dotenv.config();

async function run(delegate: LLMDelegate) {
  const transport = new mcpBundle.StdioClientTransport({
    command: 'node',
    args: [
      path.resolve(__dirname, '../../cli.js'),
      '--save-session',
      '--output-dir', path.resolve(__dirname, '../../sessions')
    ],
    stderr: 'inherit',
    env: process.env as Record<string, string>,
  });

  const client = new mcpBundle.Client({ name: 'test', version: '1.0.0' });
  await client.connect(transport);
  await client.ping();

  for (const task of tasks) {
    const messages = await runTask(delegate, client, task);
    for (const message of messages)
      console.log(`${message.role}: ${message.content}`);
  }
  await client.close();
}

const tasks = [
  'Open https://playwright.dev/',
];

program
    .option('--model <model>', 'model to use')
    .action(async options => {
      if (options.model === 'claude')
        await run(new ClaudeDelegate());
      else
        await run(new OpenAIDelegate());
    });
void program.parseAsync(process.argv);
