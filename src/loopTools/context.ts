import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { contextFactory } from '../browser-context-factory.js';
import { BrowserServerBackend } from '../browser-server-backend.js';
import type { FullConfig } from '../config.js';
import { Context as BrowserContext } from '../context.js';
import type { LLMDelegate } from '../loop/loop.js';
import { runTask } from '../loop/loop.js';
import { ClaudeDelegate } from '../loop/loopClaude.js';
import { OpenAIDelegate } from '../loop/loopOpenAI.js';
import { InProcessTransport } from '../mcp/inProcessTransport.js';
import { createServer } from '../mcp/server.js';
export class Context {
  readonly config: FullConfig;
  private readonly _client: Client;
  private readonly _delegate: LLMDelegate;
  constructor(config: FullConfig, client: Client) {
    this.config = config;
    this._client = client;
    if (process.env.OPENAI_API_KEY) {
      this._delegate = new OpenAIDelegate();
    } else if (process.env.ANTHROPIC_API_KEY) {
      this._delegate = new ClaudeDelegate();
    } else {
      throw new Error(
        'No LLM API key found. Please set OPENAI_API_KEY or ANTHROPIC_API_KEY environment variable.'
      );
    }
  }
  static async create(config: FullConfig) {
    const client = new Client({ name: 'Playwright Proxy', version: '1.0.0' });
    const browserContextFactory = contextFactory(config);
    const server = createServer(
      new BrowserServerBackend(config, [browserContextFactory]),
      false
    );
    await client.connect(new InProcessTransport(server));
    await client.ping();
    return new Context(config, client);
  }
  async runTask(
    task: string,
    oneShot = false
  ): Promise<import('../mcp/server.js').ToolResponse> {
    const messages = await runTask(this._delegate, this._client, task, oneShot);
    const lines: string[] = [];
    // Skip the first message, which is the user's task.
    for (const message of messages.slice(1)) {
      // Trim out all page snapshots.
      if (!message.content.trim()) {
        continue;
      }
      const index = oneShot ? -1 : message.content.indexOf('### Page state');
      const trimmedContent =
        index === -1 ? message.content : message.content.substring(0, index);
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
