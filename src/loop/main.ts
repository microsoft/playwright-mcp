/* eslint-disable no-console */
import path from 'path';
import url from 'url';
import dotenv from 'dotenv';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { program } from 'commander';
import { OpenAIDelegate } from './loopOpenAI.js';
import { ClaudeDelegate } from './loopClaude.js';
import { runTask } from './loop.js';
import type { LLMDelegate } from './loop.js';
dotenv.config();
const __filename = url.fileURLToPath(import.meta.url);
async function run(delegate: LLMDelegate) {
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
