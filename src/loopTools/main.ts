import dotenv from 'dotenv';
import * as mcpServer from '../mcp/server.js';
import * as mcpTransport from '../mcp/transport.js';
import { packageJSON } from '../package.js';
import { Context } from './context.js';
import { perform } from './perform.js';
import { snapshot } from './snapshot.js';
import type { FullConfig } from '../config.js';
import type { ServerBackend } from '../mcp/server.js';
import type { Tool } from './tool.js';
export async function runLoopTools(config: FullConfig) {
  dotenv.config();
  const serverBackendFactory = () => new LoopToolsServerBackend(config);
  await mcpTransport.start(serverBackendFactory, config.server);
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
    return this._tools.map(tool => tool.schema);
  }
  async callTool(schema: mcpServer.ToolSchema<any>, parsedArguments: any): Promise<mcpServer.ToolResponse> {
    const tool = this._tools.find(tool => tool.schema.name === schema.name)!;
    return await tool.handle(this._context!, parsedArguments);
  }
  serverClosed() {
    void this._context!.close();
  }
}
