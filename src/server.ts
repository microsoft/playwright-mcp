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

import http from "http";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import type { Server } from "@modelcontextprotocol/sdk/server/index.js";

/**
 * Health metrics tracked by the server
 */
export interface HealthMetrics {
  requestsToday: number;
  avgResponseMs: number;
  totalResponseMs: number;
  responseCount: number;
}

/**
 * Health status response
 */
export interface HealthStatus {
  status: "ok" | "error";
  version: string;
  uptime_seconds: number;
  auth_enabled: boolean;
  capabilities: Record<string, boolean>;
  browsers: Record<string, "ready" | "unavailable">;
  config: Record<string, any>;
  metrics: HealthMetrics;
  log_tail: string[];
}

/**
 * Log entry for log tail tracking
 */
export interface LogTailEntry {
  timestamp: string;
  message: string;
}

/**
 * Health metrics tracker
 */
class HealthMetricsTracker {
  private requestsToday: number = 0;
  private responseTimes: number[] = [];
  private logTail: LogTailEntry[] = [];
  private maxLogSize: number = 50;
  private startTime: number = Date.now();

  recordRequest(durationMs: number) {
    this.requestsToday++;
    this.responseTimes.push(durationMs);
    // Keep only last hour of response times for avg calculation
    if (this.responseTimes.length > 1000) {
      this.responseTimes = this.responseTimes.slice(-500);
    }
  }

  addLog(message: string) {
    this.logTail.push({
      timestamp: new Date().toISOString(),
      message,
    });
    if (this.logTail.length > this.maxLogSize) {
      this.logTail = this.logTail.slice(-this.maxLogSize);
    }
  }

  getMetrics(): HealthMetrics {
    const totalResponseMs = this.responseTimes.reduce((a, b) => a + b, 0);
    const avgResponseMs =
      this.responseTimes.length > 0
        ? Math.round(totalResponseMs / this.responseTimes.length)
        : 0;
    return {
      requestsToday: this.requestsToday,
      avgResponseMs,
      totalResponseMs,
      responseCount: this.responseTimes.length,
    };
  }

  getUptimeSeconds(): number {
    return Math.floor((Date.now() - this.startTime) / 1000);
  }

  getLogTail(): string[] {
    return this.logTail.map((entry) => `${entry.timestamp} ${entry.message}`);
  }
}

export type AuthenticatedServerOptions = {
  /**
   * Authentication token required in the Authorization header.
   * When set, clients must provide "Authorization: Bearer <token>" header.
   * When not set, no authentication is required.
   */
  authToken?: string;

  /**
   * Custom path for SSE messages endpoint. Defaults to '/messages'.
   */
  messagePath?: string;

  /**
   * Logger function for authentication events and warnings.
   */
  logger?: (message: string) => void;

  /**
   * Version string for health endpoint
   */
  version?: string;

  /**
   * Capabilities available on this server
   */
  capabilities?: Record<string, boolean>;

  /**
   * Browser status
   */
  browsers?: Record<string, "ready" | "unavailable">;

  /**
   * Server configuration
   */
  config?: Record<string, any>;

  /**
   * Enable health dashboard (GET /)
   */
  enableDashboard?: boolean;
};

/**
 * Generates an HTML health dashboard
 */
function generateDashboardHTML(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Playwright MCP - Health Dashboard</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background: #fff;
      color: #333;
      line-height: 1.6;
    }
    
    @media (prefers-color-scheme: dark) {
      body {
        background: #1a1a1a;
        color: #e0e0e0;
      }
    }
    
    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
    }
    
    header {
      margin-bottom: 30px;
      padding-bottom: 20px;
      border-bottom: 1px solid #ddd;
    }
    
    @media (prefers-color-scheme: dark) {
      header {
        border-bottom-color: #444;
      }
    }
    
    h1 {
      font-size: 28px;
      margin-bottom: 8px;
    }
    
    .status-indicator {
      display: inline-block;
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: #4caf50;
      margin-right: 8px;
    }
    
    .status-indicator.offline {
      background: #f44336;
    }
    
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }
    
    @media (max-width: 600px) {
      .grid {
        grid-template-columns: 1fr;
      }
    }
    
    .card {
      background: #f5f5f5;
      border-radius: 8px;
      padding: 16px;
      border: 1px solid #e0e0e0;
    }
    
    @media (prefers-color-scheme: dark) {
      .card {
        background: #2a2a2a;
        border-color: #444;
      }
    }
    
    .card h2 {
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 12px;
      color: #666;
      text-transform: uppercase;
    }
    
    @media (prefers-color-scheme: dark) {
      .card h2 {
        color: #999;
      }
    }
    
    .card-content {
      font-size: 14px;
    }
    
    .stat {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #e0e0e0;
    }
    
    @media (prefers-color-scheme: dark) {
      .stat {
        border-bottom-color: #444;
      }
    }
    
    .stat:last-child {
      border-bottom: none;
    }
    
    .stat-label {
      font-weight: 500;
    }
    
    .stat-value {
      font-family: "Monaco", "Menlo", "Courier New", monospace;
      color: #0066cc;
    }
    
    @media (prefers-color-scheme: dark) {
      .stat-value {
        color: #66b3ff;
      }
    }
    
    .capability-badge {
      display: inline-block;
      padding: 4px 8px;
      margin: 4px 4px 4px 0;
      border-radius: 4px;
      font-size: 12px;
      background: #e8f5e9;
      color: #2e7d32;
    }
    
    .capability-badge.off {
      background: #ffebee;
      color: #c62828;
    }
    
    @media (prefers-color-scheme: dark) {
      .capability-badge {
        background: #1b5e20;
        color: #81c784;
      }
      
      .capability-badge.off {
        background: #b71c1c;
        color: #ef9a9a;
      }
    }
    
    .browser-status {
      display: flex;
      align-items: center;
      padding: 8px 0;
      font-size: 14px;
    }
    
    .browser-status-indicator {
      display: inline-block;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #4caf50;
      margin-right: 8px;
    }
    
    .browser-status-indicator.unavailable {
      background: #f44336;
    }
    
    .log-section {
      background: #f5f5f5;
      border-radius: 8px;
      padding: 16px;
      border: 1px solid #e0e0e0;
      margin-top: 30px;
    }
    
    @media (prefers-color-scheme: dark) {
      .log-section {
        background: #2a2a2a;
        border-color: #444;
      }
    }
    
    .log-section h2 {
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 12px;
      color: #666;
      text-transform: uppercase;
    }
    
    @media (prefers-color-scheme: dark) {
      .log-section h2 {
        color: #999;
      }
    }
    
    .log-lines {
      background: #000;
      color: #0f0;
      padding: 12px;
      border-radius: 4px;
      font-family: "Monaco", "Menlo", "Courier New", monospace;
      font-size: 12px;
      height: 300px;
      overflow-y: auto;
      white-space: pre-wrap;
      word-wrap: break-word;
    }
    
    @media (prefers-color-scheme: dark) {
      .log-lines {
        background: #0a0a0a;
        color: #00ff00;
      }
    }
    
    .refresh-indicator {
      font-size: 12px;
      color: #999;
      margin-top: 8px;
      text-align: right;
    }
    
    .full-width {
      grid-column: 1 / -1;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>
        <span class="status-indicator" id="statusIndicator"></span>
        Playwright MCP Health Dashboard
      </h1>
      <p style="color: #666; margin-top: 4px;">Real-time server status and metrics</p>
    </header>

    <div class="grid">
      <div class="card">
        <h2>Server Status</h2>
        <div class="card-content">
          <div class="stat">
            <span class="stat-label">Status</span>
            <span class="stat-value" id="statusValue">-</span>
          </div>
          <div class="stat">
            <span class="stat-label">Version</span>
            <span class="stat-value" id="versionValue">-</span>
          </div>
          <div class="stat">
            <span class="stat-label">Uptime</span>
            <span class="stat-value" id="uptimeValue">-</span>
          </div>
          <div class="stat">
            <span class="stat-label">Auth Enabled</span>
            <span class="stat-value" id="authValue">-</span>
          </div>
        </div>
      </div>

      <div class="card">
        <h2>Metrics</h2>
        <div class="card-content">
          <div class="stat">
            <span class="stat-label">Requests Today</span>
            <span class="stat-value" id="requestsValue">-</span>
          </div>
          <div class="stat">
            <span class="stat-label">Avg Response Time</span>
            <span class="stat-value" id="avgResponseValue">-</span>
          </div>
        </div>
      </div>

      <div class="card">
        <h2>Browsers</h2>
        <div class="card-content" id="browsersContent">
          -
        </div>
      </div>

      <div class="card">
        <h2>Capabilities</h2>
        <div class="card-content" id="capabilitiesContent">
          -
        </div>
      </div>

      <div class="card full-width">
        <h2>Configuration</h2>
        <div class="card-content" id="configContent">
          -
        </div>
      </div>
    </div>

    <div class="log-section">
      <h2>Live Log (Last 50 entries)</h2>
      <div class="log-lines" id="logLines">Loading logs...</div>
      <div class="refresh-indicator">Updating every 5 seconds...</div>
    </div>
  </div>

  <script>
    async function updateDashboard() {
      try {
        const response = await fetch('/api/health');
        if (!response.ok) throw new Error('Failed to fetch health data');
        
        const data = await response.json();
        
        // Update status
        document.getElementById('statusIndicator').className = 
          data.status === 'ok' ? 'status-indicator' : 'status-indicator offline';
        document.getElementById('statusValue').textContent = data.status.toUpperCase();
        document.getElementById('versionValue').textContent = data.version || 'unknown';
        document.getElementById('uptimeValue').textContent = formatUptime(data.uptime_seconds);
        document.getElementById('authValue').textContent = data.auth_enabled ? 'Yes' : 'No';
        
        // Update metrics
        document.getElementById('requestsValue').textContent = data.metrics.requestsToday;
        document.getElementById('avgResponseValue').textContent = data.metrics.avgResponseMs + ' ms';
        
        // Update browsers
        const browsersHtml = Object.entries(data.browsers)
          .map(([name, status]) => 
            '<div class="browser-status">' +
            '<span class="browser-status-indicator ' + (status === 'ready' ? '' : 'unavailable') + '"></span>' +
            name.charAt(0).toUpperCase() + name.slice(1) + ': ' + status +
            '</div>'
          )
          .join('');
        document.getElementById('browsersContent').innerHTML = browsersHtml;
        
        // Update capabilities
        const capsHtml = Object.entries(data.capabilities)
          .map(([name, enabled]) => 
            '<span class="capability-badge ' + (enabled ? '' : 'off') + '">' + name + '</span>'
          )
          .join('');
        document.getElementById('capabilitiesContent').innerHTML = capsHtml;
        
        // Update config
        const configHtml = Object.entries(data.config)
          .map(([key, value]) =>
            '<div class="stat"><span class="stat-label">' + key + '</span>' +
            '<span class="stat-value">' + JSON.stringify(value) + '</span></div>'
          )
          .join('');
        document.getElementById('configContent').innerHTML = configHtml;
        
        // Update logs
        document.getElementById('logLines').textContent = data.log_tail.join('\\n');
        // Scroll to bottom
        document.getElementById('logLines').scrollTop = document.getElementById('logLines').scrollHeight;
      } catch (error) {
        console.error('Dashboard update failed:', error);
        document.getElementById('statusIndicator').className = 'status-indicator offline';
      }
    }
    
    function formatUptime(seconds) {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const secs = seconds % 60;
      
      if (hours > 0) return hours + 'h ' + minutes + 'm';
      if (minutes > 0) return minutes + 'm ' + secs + 's';
      return secs + 's';
    }
    
    // Initial update
    updateDashboard();
    
    // Update every 5 seconds
    setInterval(updateDashboard, 5000);
  </script>
</body>
</html>`;
}

/**
 * Wraps an HTTP request handler to add Bearer token authentication for SSE transport.
 *
 * @param connection The MCP server connection
 * @param options Authentication and configuration options
 * @returns An HTTP request handler with authentication
 *
 * @example
 * ```ts
 * import http from 'http';
 * import { createConnection } from '@playwright/mcp';
 * import { createAuthenticatedHandler } from '@playwright/mcp/src/server';
 *
 * const connection = await createConnection();
 * const handler = createAuthenticatedHandler(connection, {
 *   authToken: 'my-secret-token',
 *   logger: console.log,
 *   enableDashboard: true,
 * });
 *
 * http.createServer(handler).listen(8080);
 * ```
 */
export function createAuthenticatedHandler(
  connection: Server,
  options: AuthenticatedServerOptions = {},
): (req: http.IncomingMessage, res: http.ServerResponse) => void {
  const {
    authToken,
    messagePath = "/messages",
    logger = console.log,
    version = "unknown",
    capabilities = {},
    browsers = {},
    config = {},
    enableDashboard = true,
  } = options;

  const metrics = new HealthMetricsTracker();

  return async (req: http.IncomingMessage, res: http.ServerResponse) => {
    const startTime = Date.now();
    const url = new URL(req.url || "/", `http://${req.headers.host}`);

    try {
      // Handle health API endpoint
      if (url.pathname === "/api/health" && req.method === "GET") {
        const healthStatus: HealthStatus = {
          status: "ok",
          version,
          uptime_seconds: metrics.getUptimeSeconds(),
          auth_enabled: !!authToken,
          capabilities,
          browsers,
          config,
          metrics: metrics.getMetrics(),
          log_tail: metrics.getLogTail(),
        };

        res.writeHead(200, {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
        });
        res.end(JSON.stringify(healthStatus));
        metrics.recordRequest(Date.now() - startTime);
        return;
      }

      // Handle dashboard
      if (url.pathname === "/" && req.method === "GET" && enableDashboard) {
        res.writeHead(200, {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-cache",
        });
        res.end(generateDashboardHTML());
        metrics.recordRequest(Date.now() - startTime);
        return;
      }

      // Handle SSE messages endpoint
      if (url.pathname === messagePath) {
        // Check authentication if token is configured
        if (authToken) {
          const authHeader = req.headers.authorization || "";
          const bearerMatch = authHeader.match(/^Bearer\s+(\S+)$/);
          const clientToken = bearerMatch?.[1];

          if (!clientToken) {
            res.writeHead(401, {
              "Content-Type": "text/plain",
              "WWW-Authenticate": 'Bearer realm="Playwright MCP"',
            });
            res.end("Unauthorized: Missing authorization token");
            metrics.recordRequest(Date.now() - startTime);
            return;
          }

          if (clientToken !== authToken) {
            res.writeHead(401, {
              "Content-Type": "text/plain",
              "WWW-Authenticate": 'Bearer realm="Playwright MCP"',
            });
            res.end("Unauthorized: Invalid authorization token");
            metrics.recordRequest(Date.now() - startTime);
            return;
          }
        }

        // Connect to SSE transport
        const transport = new SSEServerTransport(messagePath, res);
        await connection.connect(transport);
        metrics.recordRequest(Date.now() - startTime);
        return;
      }

      // Return 404 for unknown paths
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not Found");
      metrics.recordRequest(Date.now() - startTime);
    } catch (error) {
      logger(`Error handling request: ${error}`);
      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end("Internal Server Error");
      }
      metrics.recordRequest(Date.now() - startTime);
    }
  };
}

/**
 * Validates authentication and logs warnings if misconfigured.
 *
 * Logs a warning if --port is used without --auth-token in production-like environments.
 *
 * @param port The port number (if server is running in HTTP mode)
 * @param authToken The configured authentication token
 * @param logger Logger function
 * @param host The host the server is bound to
 */
export function validateServerConfiguration(
  port: number | undefined,
  authToken: string | undefined,
  logger: (message: string) => void = console.warn,
  host: string = "localhost",
): void {
  if (port && !authToken) {
    const isLocalhost = host === "localhost" || host === "127.0.0.1";
    const environment = isLocalhost ? "local" : "remote";

    logger(
      `⚠️  Playwright MCP server is running on HTTP ${environment} (${host}:${port}) without authentication. ` +
        `This is insecure. Set --auth-token or PLAYWRIGHT_MCP_AUTH_TOKEN to require Bearer token authentication.`,
    );
  }
}
