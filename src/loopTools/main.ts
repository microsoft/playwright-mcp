import dotenv from 'dotenv';
import type { FullConfig } from '../config.js';
import type { ServerBackend, ToolResponse, ToolSchema } from '../mcp/server.js';
import { start } from '../mcp/transport.js';
import { packageJSON } from '../package.js';
import { Context } from './context.js';
import { perform } from './perform.js';
import { snapshot } from './snapshot.js';
export async function runLoopTools(config: FullConfig) {
  dotenv.config();
  const serverBackendFactory = () => new LoopToolsServerBackend(config);
  await start(serverBackendFactory, config.server);
}
class LoopToolsServerBackend implements ServerBackend {
  readonly name = 'Playwright';
  readonly version = packageJSON.version;
  private readonly _config: FullConfig;
  private _context: Context | undefined;
  private readonly _tools = [perform, snapshot];
  constructor(config: FullConfig) {
    this._config = config;
  }
  async initialize() {
    this._context = await Context.create(this._config);
  }
  tools(): ToolSchema[] {
    return this._tools.map((tool) => tool.schema as ToolSchema);
  }

  async callTool(
    schema: mcpServer.ToolSchema<any>,
    rawArguments: any
  ): Promise<mcpServer.ToolResponse> {
    const tool = this._tools.find((t) => t.schema.name === schema.name);
    if (!tool) {
      throw new Error(`Tool not found: ${schema.name}`);
    }
    if (!this._context) {
      throw new Error('Context not initialized');
    }
    const parsedArguments = schema.inputSchema.parse(rawArguments || {});
    return await tool.handle(this._context, parsedArguments);
  }
  serverClosed() {
    this._context?.close().catch(() => {
      // Context close failed during server shutdown - ignore since server is shutting down
    });
  }
}
