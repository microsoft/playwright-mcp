import dotenv from 'dotenv';
import type { FullConfig } from '../config.js';
import type * as mcpServer from '../mcp/server.js';
import type { ServerBackend } from '../mcp/server.js';
import { start } from '../mcp/transport.js';
import { packageJSON } from '../package.js';
import { Context } from './context.js';
import { perform } from './perform.js';
import { snapshot } from './snapshot.js';
import type { Tool } from './tool.js';
export async function runLoopTools(config: FullConfig) {
  dotenv.config();
  const serverBackendFactory = () => new LoopToolsServerBackend(config);
  await start(serverBackendFactory, config.server);
}
class LoopToolsServerBackend implements ServerBackend {
  readonly name = 'Playwright';
  readonly version = packageJSON.version;
  private _config: FullConfig;
  private _context: Context | undefined;
  private _tools: Tool<any>[] = [perform, snapshot];
  constructor(config: FullConfig) {
    this._config = config;
  }
  async initialize() {
    this._context = await Context.create(this._config);
  }
  tools(): mcpServer.ToolSchema<any>[] {
    return this._tools.map((tool) => tool.schema);
  }
  async callTool(
    schema: mcpServer.ToolSchema<any>,
    parsedArguments: Record<string, unknown>
  ): Promise<mcpServer.ToolResponse> {
    const tool = this._tools.find((t) => t.schema.name === schema.name);
    if (!tool) {
      throw new Error(`Tool not found: ${schema.name}`);
    }
    if (!this._context) {
      throw new Error('Context not initialized');
    }
    return await tool.handle(this._context, parsedArguments);
  }
  serverClosed() {
    this._context?.close().catch(() => {
      // Context close errors are handled internally
    });
  }
}
