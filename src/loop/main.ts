import path from 'node:path';
import url from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { program } from 'commander';
import dotenv from 'dotenv';
import type { LLMDelegate } from './loop.js';
import { runTask } from './loop.js';
import { ClaudeDelegate } from './loop-claude.js';
import { OpenAIDelegate } from './loop-open-ai.js';

dotenv.config();
const __filename = url.fileURLToPath(import.meta.url);
async function run(delegate: LLMDelegate) {
  const transport = new StdioClientTransport({
    command: 'node',
    args: [
      path.resolve(__filename, '../../../cli.js'),
      '--save-session',
      '--output-dir',
      path.resolve(__filename, '../../../sessions'),
    ],
    stderr: 'inherit',
    env: process.env as Record<string, string>,
  });
  const client = new Client({ name: 'test', version: '1.0.0' });
  await client.connect(transport);
  await client.ping();
  await Promise.all(tasks.map((task) => runTask(delegate, client, task)));

  await client.close();
}
const tasks = ['Open https://playwright.dev/'];
program.option('--model <model>', 'model to use').action(async (options) => {
  if (options.model === 'claude') {
    await run(new ClaudeDelegate());
  } else {
    await run(new OpenAIDelegate());
  }
});
async function startCLI() {
  try {
    await program.parseAsync(process.argv);
  } catch {
    // CLI parsing failed - exit with error code
    process.exit(1);
  }
}

startCLI();
