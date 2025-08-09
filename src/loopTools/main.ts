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
    schema: ToolSchema,
    parsedArguments: Record<string, unknown>
  ): Promise<ToolResponse> {
    const tool = this._tools.find((t) => t.schema.name === schema.name);
    if (!tool) {
      throw new Error(`Tool not found: ${schema.name}`);
    }
    if (!this._context) {
      throw new Error('Context not initialized');
    }
    // Since we found the tool by schema name, the parsedArguments should match the tool's input schema
    // biome-ignore lint/suspicious/noExplicitAny: Union type requires any for proper type handling across different tool schemas
    return await tool.handle(this._context, parsedArguments as any);
  }
  serverClosed() {
    this._context?.close().catch((_error) => {
      // Context close failed during server shutdown - ignore since server is shutting down
    });
  }
}
