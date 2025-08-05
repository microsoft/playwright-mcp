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
import { contextFactory } from '../browserContextFactory.js';
import { BrowserServerBackend } from '../browserServerBackend.js';
import { Context as BrowserContext } from '../context.js';
import { runTask } from '../loop/loop.js';
import { OpenAIDelegate } from '../loop/loopOpenAI.js';
import { ClaudeDelegate } from '../loop/loopClaude.js';
import { InProcessTransport } from '../mcp/inProcessTransport.js';
import * as mcpServer from '../mcp/server.js';

import type { LLMDelegate } from '../loop/loop.js';
import type { FullConfig } from '../config.js';

export class Context {
  readonly config: FullConfig;
  private _client: Client;
  private _delegate: LLMDelegate;

  constructor(config: FullConfig, client: Client) {
    this.config = config;
    this._client = client;
    if (process.env.OPENAI_API_KEY)
      this._delegate = new OpenAIDelegate();
    else if (process.env.ANTHROPIC_API_KEY)
      this._delegate = new ClaudeDelegate();
    else
      throw new Error('No LLM API key found. Please set OPENAI_API_KEY or ANTHROPIC_API_KEY environment variable.');
  }

  static async create(config: FullConfig) {
    const client = new Client({ name: 'Playwright Proxy', version: '1.0.0' });
    const browserContextFactory = contextFactory(config);
    const server = mcpServer.createServer(new BrowserServerBackend(config, [browserContextFactory]), false);
    await client.connect(new InProcessTransport(server));
    await client.ping();
    return new Context(config, client);
  }

  async runTask(task: string, oneShot: boolean = false): Promise<mcpServer.ToolResponse> {
    const messages = await runTask(this._delegate, this._client!, task, oneShot);
    const lines: string[] = [];

    // Skip the first message, which is the user's task.
    for (const message of messages.slice(1)) {
      // Trim out all page snapshots.
      if (!message.content.trim())
        continue;
      const index = oneShot ? -1 : message.content.indexOf('### Page state');
      const trimmedContent = index === -1 ? message.content : message.content.substring(0, index);
      lines.push(`[${message.role}]:`, trimmedContent);
    }

    return {
      content: [{ type: 'text', text: lines.join('\n') }],
    };
  }

  async close() {
    await BrowserContext.disposeAll();
  }
}
