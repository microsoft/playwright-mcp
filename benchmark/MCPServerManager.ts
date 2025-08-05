/**
 * MCP Server Management
 */

import { spawn, ChildProcess } from 'child_process';
import { BenchmarkConfig } from './config.js';
import { MCPRequest, MCPResponse, ServerType } from './types.js';
import { ProcessUtils, ValidationUtils } from './utils.js';

export class MCPServerManager {
  public servers: Record<ServerType, ChildProcess | null> = {
    original: null,
    fast: null
  };
  
  private config: BenchmarkConfig;

  constructor(config: BenchmarkConfig) {
    this.config = config;
  }

  /**
   * Start all MCP servers
   */
  async startServers(): Promise<void> {
    console.log('🚀 Starting MCP servers...');
    
    // Start original server
    const originalConfig = this.config.servers.original;
    this.servers.original = spawn(originalConfig.command, originalConfig.args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, ...originalConfig.env },
      cwd: originalConfig.cwd || process.cwd()
    });
    
    // Start fast server
    const fastConfig = this.config.servers.fast;
    this.servers.fast = spawn(fastConfig.command, fastConfig.args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, ...fastConfig.env },
      cwd: fastConfig.cwd || process.cwd()
    });
    
    // Add error handlers
    this.addErrorHandlers();
    
    // Wait for servers to initialize
    console.log('⏳ Waiting for servers to initialize...');
    await ProcessUtils.wait(this.config.timeouts.initialization);
    
    // Initialize connections
    await this.initializeConnections();
    
    console.log('✅ Servers ready');
  }

  /**
   * Add error handlers to server processes
   */
  private addErrorHandlers(): void {
    this.servers.original?.on('error', (err) => {
      console.error('Original server error:', err);
    });
    
    this.servers.fast?.on('error', (err) => {
      console.error('Fast server error:', err);
    });
  }

  /**
   * Initialize MCP connections for all servers
   */
  private async initializeConnections(): Promise<void> {
    for (const [serverType, server] of Object.entries(this.servers)) {
      if (server) {
        await this.initializeServer(server, serverType as ServerType);
      }
    }
  }

  /**
   * Initialize a single MCP server connection
   */
  async initializeServer(server: ChildProcess, serverType: ServerType): Promise<void> {
    console.log(`  Initializing ${serverType} server...`);
    
    if (!ValidationUtils.isProcessRunning(server)) {
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
        clientInfo: { name: 'benchmark', version: '1.0.0' }
      }
    };

    server.stdin?.write(JSON.stringify(initRequest) + '\n');
    
    // Wait for initialize response
    await this.waitForResponse(server, 'init', this.config.timeouts.initialization);
    
    // Send initialized notification
    const initializedNotification: MCPRequest = {
      jsonrpc: '2.0',
      method: 'notifications/initialized'
    };
    
    server.stdin?.write(JSON.stringify(initializedNotification) + '\n');
    
    // Additional wait for full initialization
    await ProcessUtils.wait(1000);
  }

  /**
   * Wait for specific MCP response
   */
  private async waitForResponse(
    server: ChildProcess, 
    requestId: string | number, 
    timeoutMs: number
  ): Promise<MCPResponse> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        server.stdout?.removeListener('data', handler);
        reject(new Error(`Timeout waiting for response to ${requestId}`));
      }, timeoutMs);
      
      const handler = (data: Buffer) => {
        const lines = data.toString().split('\n');
        for (const line of lines) {
          if (line.trim()) {
            try {
              const response = JSON.parse(line);
              if (ValidationUtils.isValidMCPResponse(response) && response.id === requestId) {
                clearTimeout(timeout);
                server.stdout?.removeListener('data', handler);
                resolve(response);
                return;
              }
            } catch (e) {
              // Invalid JSON, continue parsing other lines
            }
          }
        }
      };
      
      server.stdout?.on('data', handler);
    });
  }

  /**
   * Call a tool on a specific server
   */
  async callTool(
    serverType: ServerType, 
    toolName: string, 
    args: Record<string, any> = {}
  ): Promise<{ size: number; tokens: number; response: MCPResponse }> {
    const server = this.servers[serverType];
    
    if (!server || !ValidationUtils.isProcessRunning(server)) {
      throw new Error(`${serverType} server is not available`);
    }

    const request: MCPRequest = {
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: args
      }
    };

    server.stdin?.write(JSON.stringify(request) + '\n');
    
    // Use longer timeout for screenshot operations
    const timeoutMs = toolName.includes('screenshot') ? 
      this.config.timeouts.screenshotCall : 
      this.config.timeouts.toolCall;
    
    const response = await this.waitForResponse(server, request.id!, timeoutMs);
    
    if (response.error) {
      throw new Error(`Tool call failed: ${response.error.message}`);
    }

    const responseText = response.result?.content?.[0]?.text || '';
    const size = JSON.stringify(response).length;
    const tokens = Math.ceil(responseText.length / 4);
    
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
    return server ? ValidationUtils.isProcessRunning(server) : false;
  }

  /**
   * Stop a specific server
   */
  async stopServer(serverType: ServerType): Promise<void> {
    const server = this.servers[serverType];
    if (!server) return;
    
    console.log(`🛑 Stopping ${serverType} server...`);
    
    try {
      server.kill('SIGTERM');
      
      // Wait a bit for graceful shutdown
      await ProcessUtils.wait(1000);
      
      // Force kill if still running
      if (ValidationUtils.isProcessRunning(server)) {
        server.kill('SIGKILL');
        await ProcessUtils.wait(500);
      }
    } catch (error) {
      console.warn(`Warning: Error shutting down ${serverType} server:`, error);
    }
    
    this.servers[serverType] = null;
  }

  /**
   * Shutdown all servers
   */
  async shutdown(): Promise<void> {
    console.log('\n🧹 Shutting down servers...');
    
    for (const serverType of Object.keys(this.servers) as ServerType[]) {
      await this.stopServer(serverType);
    }
    
    await ProcessUtils.wait(1000);
  }
}