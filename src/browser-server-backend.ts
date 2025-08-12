import { fileURLToPath } from 'node:url';
import debug from 'debug';
import { z } from 'zod';
import type { BrowserContextFactory } from './browser-context-factory.js';
import type { FullConfig } from './config.js';
import { Context } from './context.js';
import { logUnhandledError } from './log.js';
import type * as mcpServer from './mcp/server.js';
import { packageJSON } from './package.js';
import { Response } from './response.js';
import type { ExpectationOptions } from './schemas/expectation.js';
import { SessionLog } from './session-log.js';
import type { AnyTool } from './tools/tool.js';
import { defineTool } from './tools/tool.js';
import { filteredTools } from './tools.js';

const backendDebug = debug('pw:mcp:backend');

type NonEmptyArray<T> = [T, ...T[]];
export type FactoryList = NonEmptyArray<BrowserContextFactory>;
export class BrowserServerBackend implements mcpServer.ServerBackend {
  name = 'Playwright';
  version = packageJSON.version;
  private readonly _tools: AnyTool[];
  private _context: Context | undefined;
  private _sessionLog: SessionLog | undefined;
  private readonly _config: FullConfig;
  private _browserContextFactory: BrowserContextFactory;
  constructor(config: FullConfig, factories: FactoryList) {
    this._config = config;
    this._browserContextFactory = factories[0];
    this._tools = filteredTools(config);
    if (factories.length > 1) {
      this._tools.push(this._defineContextSwitchTool(factories));
    }
  }
  async initialize(server: mcpServer.Server): Promise<void> {
    const capabilities =
      server.getClientCapabilities() as mcpServer.ClientCapabilities;
    let rootPath: string | undefined;
    if (
      capabilities.roots &&
      (server.getClientVersion()?.name === 'Visual Studio Code' ||
        server.getClientVersion()?.name === 'Visual Studio Code - Insiders')
    ) {
      const { roots } = await server.listRoots();
      const firstRootUri = roots[0]?.uri;
      const url = firstRootUri ? new URL(firstRootUri) : undefined;
      rootPath = url ? fileURLToPath(url) : undefined;
    }
    this._sessionLog = this._config.saveSession
      ? await SessionLog.create(this._config, rootPath)
      : undefined;
    this._context = new Context({
      tools: this._tools,
      config: this._config,
      browserContextFactory: this._browserContextFactory,
      sessionLog: this._sessionLog,
      clientInfo: { ...server.getClientVersion(), rootPath },
    });
  }
  tools(): mcpServer.ToolSchema[] {
    return this._tools.map((tool) => tool.schema);
  }
  async callTool(
    schema: mcpServer.ToolSchema,
    rawArguments: Record<string, unknown> | undefined
  ) {
    if (!this._context) {
      throw new Error('Context not initialized. Call initialize() first.');
    }

    const context = this._context;
    const parsedArguments = schema.inputSchema.parse(rawArguments || {});
    const response = new Response(
      context,
      schema.name,
      parsedArguments,
      parsedArguments.expectation as ExpectationOptions | undefined
    );

    const matchedTool = this._tools.find((t) => t.schema.name === schema.name);
    if (!matchedTool) {
      throw new Error(`Tool not found: ${schema.name}`);
    }

    context.setRunningTool(true);
    try {
      await matchedTool.handle(context, parsedArguments, response);
      await response.finish();
      this._sessionLog?.logResponse(response);
    } catch (error: unknown) {
      backendDebug(`Error executing tool ${schema.name}:`, error);
      response.addError(String(error));
    } finally {
      context.setRunningTool(false);
    }
    return response.serialize();
  }
  serverClosed() {
    this._context?.dispose().catch(logUnhandledError);
  }
  private _defineContextSwitchTool(factories: FactoryList): AnyTool {
    const self = this;
    return defineTool({
      capability: 'core',
      schema: {
        name: 'browser_connect',
        title: 'Connect to a browser context',
        description: [
          'Connect to a browser using one of the available methods:',
          ...factories.map(
            (factory) => `- "${factory.name}": ${factory.description}`
          ),
        ].join('\n'),
        inputSchema: z.object({
          method: z
            .enum(factories.map((f) => f.name) as [string, ...string[]])
            .default(factories[0].name)
            .describe('The method to use to connect to the browser'),
        }),
        type: 'readOnly',
      },
      async handle(_context, params, response) {
        const selectedFactory = factories.find((f) => f.name === params.method);
        if (!selectedFactory) {
          response.addError(`Unknown connection method: ${params.method}`);
          return;
        }
        await self._setContextFactory(selectedFactory);
        response.addResult('Successfully changed connection method.');
      },
    });
  }
  private async _setContextFactory(newFactory: BrowserContextFactory) {
    if (this._context) {
      const options = {
        ...this._context.options,
        browserContextFactory: newFactory,
      };
      await this._context.dispose();
      this._context = new Context(options);
    }
    this._browserContextFactory = newFactory;
  }
}
