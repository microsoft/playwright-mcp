/**
 * MCP Server Management
 */

import { type ChildProcess, spawn } from 'node:child_process';
import { diagnosticWarn } from '../src/diagnostics/common/diagnostic-base.js';
import type { BenchmarkConfig } from './config.js';
import type { MCPRequest, MCPResponse, ServerType } from './types.js';
import {
  calculateMetrics,
  isProcessRunning,
  isValidMCPResponse,
  wait,
} from './utils.js';

export class MCPServerManager {
  readonly servers: Record<ServerType, ChildProcess | null> = {
    original: null,
    fast: null,
  };

  private config: BenchmarkConfig;

  constructor(config: BenchmarkConfig) {
    this.config = config;
  }

  /**
   * Start all MCP servers
   */
  async startServers(): Promise<void> {
    // Start original server
    const originalConfig = this.config.servers.original;
    this.servers.original = spawn(originalConfig.command, originalConfig.args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, ...originalConfig.env },
      cwd: originalConfig.cwd || process.cwd(),
    });

    // Start fast server
    const fastConfig = this.config.servers.fast;
    this.servers.fast = spawn(fastConfig.command, fastConfig.args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, ...fastConfig.env },
      cwd: fastConfig.cwd || process.cwd(),
    });

    // Add error handlers
    this.addErrorHandlers();
    await wait(this.config.timeouts.initialization);

    // Initialize connections
    await this.initializeConnections();
  }

  /**
   * Add error handlers to server processes
   */
  private addErrorHandlers(): void {
    this.servers.original?.on('error', (_err: Error) => {
      // Error is handled by the server manager
    });

    this.servers.fast?.on('error', (_err: Error) => {
      // Error is handled by the server manager
    });
  }

  /**
   * Initialize MCP connections for all servers
   */
  private async initializeConnections(): Promise<void> {
    await Promise.all(
      Object.entries(this.servers)
        .filter(([_, server]) => server)
        .map(([serverType, server]) => {
          if (!server) {
            throw new Error(`Server ${serverType} is not available`);
          }
          return this.initializeServer(server, serverType as ServerType);
        })
    );
  }

  /**
   * Initialize a single MCP server connection
   */
  async initializeServer(
    server: ChildProcess,
    serverType: ServerType
  ): Promise<void> {
    if (!isProcessRunning(server)) {
      throw new Error(`${serverType} server process is not running`);
    }

    // Send initialize request
    const initRequest: MCPRequest = {
      jsonrpc: '2.0',
      id: 'init',
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'benchmark', version: '1.0.0' },
      },
    };

    server.stdin?.write(`${JSON.stringify(initRequest)}\n`);

    // Wait for initialize response
    await this.waitForResponse(
      server,
      'init',
      this.config.timeouts.initialization
    );

    // Send initialized notification
    const initializedNotification: MCPRequest = {
      jsonrpc: '2.0',
      method: 'notifications/initialized',
    };

    server.stdin?.write(`${JSON.stringify(initializedNotification)}\n`);

    // Additional wait for full initialization
    await wait(1000);
  }

  /**
   * Wait for specific MCP response
   */
  private waitForResponse(
    server: ChildProcess,
    requestId: string | number,
    timeoutMs: number
  ): Promise<MCPResponse> {
    return new Promise((resolve, reject) => {
      const cleanup = () => {
        server.stdout?.removeListener('data', handler);
        clearTimeout(timeout);
      };

      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error(`Timeout waiting for response to ${requestId}`));
      }, timeoutMs);

      const handler = (data: Buffer) => {
        const response = this.parseResponseFromBuffer(data, requestId);
        if (response) {
          cleanup();
          resolve(response);
        }
      };

      server.stdout?.on('data', handler);
    });
  }

  /**
   * Parse MCP response from buffer data
   */
  private parseResponseFromBuffer(
    data: Buffer,
    targetRequestId: string | number
  ): MCPResponse | null {
    const lines = data.toString().split('\n');

    for (const line of lines) {
      if (!line.trim()) {
        continue;
      }

      const response = this.tryParseJsonResponse(line, targetRequestId);
      if (response) {
        return response;
      }
    }

    return null;
  }

  /**
   * Attempt to parse a single line as JSON MCP response
   */
  private tryParseJsonResponse(
    line: string,
    targetRequestId: string | number
  ): MCPResponse | null {
    try {
      const response = JSON.parse(line);
      if (isValidMCPResponse(response) && response.id === targetRequestId) {
        return response;
      }
    } catch {
      // Invalid JSON, continue parsing other lines
    }
    return null;
  }

  /**
   * Call a tool on a specific server
   */
  async callTool(
    serverType: ServerType,
    toolName: string,
    args: Record<string, unknown> = {}
  ): Promise<{ size: number; tokens: number; response: MCPResponse }> {
    const server = this.servers[serverType];

    if (!(server && isProcessRunning(server))) {
      throw new Error(`${serverType} server is not available`);
    }

    const request: MCPRequest = {
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: args,
      },
    };

    server.stdin?.write(`${JSON.stringify(request)}\n`);

    // Use longer timeout for screenshot operations
    const timeoutMs = toolName.includes('screenshot')
      ? this.config.timeouts.screenshotCall
      : this.config.timeouts.toolCall;

    const response = await this.waitForResponse(
      server,
      request.id as string | number,
      timeoutMs
    );

    if (response.error) {
      throw new Error(`Tool call failed: ${response.error.message}`);
    }

    const { size, tokens } = calculateMetrics(response);

    return { size, tokens, response };
  }

  /**
   * Get server instance
   */
  getServer(serverType: ServerType): ChildProcess | null {
    return this.servers[serverType];
  }

  /**
   * Check if server is running
   */
  isServerRunning(serverType: ServerType): boolean {
    const server = this.servers[serverType];
    return server ? isProcessRunning(server) : false;
  }

  /**
   * Stop a specific server
   */
  async stopServer(serverType: ServerType): Promise<void> {
    const server = this.servers[serverType];
    if (!server) {
      return;
    }

    try {
      server.kill('SIGTERM');

      // Wait a bit for graceful shutdown
      await wait(1000);

      // Force kill if still running
      if (isProcessRunning(server)) {
        server.kill('SIGKILL');
        await wait(500);
      }
    } catch (error: unknown) {
      // Log error but continue with server shutdown
      diagnosticWarn(
        'McpServerManager',
        'stopServer',
        'Error during server shutdown',
        error instanceof Error ? error.message : String(error)
      );
    }

    this.servers[serverType] = null;
  }

  /**
   * Shutdown all servers
   */
  async shutdown(): Promise<void> {
    await Promise.all(
      (Object.keys(this.servers) as ServerType[]).map((serverType) =>
        this.stopServer(serverType)
      )
    );

    await wait(1000);
  }
}
