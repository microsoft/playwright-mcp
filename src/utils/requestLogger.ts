// @ts-nocheck
import { appendFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { requestDebug } from '../log.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const LOG_DIR = join(PROJECT_ROOT, 'logs');
const LOG_FILE = join(LOG_DIR, 'mcp-requests.log');

// Check if file logging is enabled via environment variable
const FILE_LOGGING_ENABLED =
  process.env.PLAYWRIGHT_MCP_LOG_REQUESTS === 'file' ||
  process.env.PLAYWRIGHT_MCP_LOG_REQUESTS === 'both';

// Ensure log directory exists if file logging is enabled
if (FILE_LOGGING_ENABLED && !existsSync(LOG_DIR)) {
  mkdirSync(LOG_DIR, { recursive: true });
}

export interface RequestLogEntry {
  timestamp: string;
  toolName: string;
  params: Record<string, unknown>;
  requestId?: string;
}

export function logRequest(
  toolName: string,
  params: Record<string, unknown>
): void {
  try {
    const timestamp = new Date().toISOString();
    const requestId = Math.random().toString(36).substring(7);

    // Debug logging (always available via DEBUG env var)
    requestDebug(
      'Tool: %s (ID: %s) - Parameters: %o',
      toolName,
      requestId,
      params
    );

    // File logging (only if enabled)
    if (FILE_LOGGING_ENABLED) {
      // Format as human-readable log entry
      const logEntry = [
        `[${timestamp}] Tool: ${toolName} (ID: ${requestId})`,
        `Parameters: ${JSON.stringify(params, null, 2)}`,
        '---',
      ].join('\n');

      appendFileSync(LOG_FILE, `${logEntry}\n`, 'utf-8');
    }
  } catch (error) {
    // Silently fail to not interfere with normal operation
    requestDebug('Failed to log request: %o', error);
  }
}

export function getLogFilePath(): string {
  return LOG_FILE;
}

export function logServerStart(): void {
  try {
    const timestamp = new Date().toISOString();

    // Debug logging
    requestDebug(
      '=== MCP Server Started === PID: %d, Node: %s',
      process.pid,
      process.version
    );

    // File logging (only if enabled)
    if (FILE_LOGGING_ENABLED) {
      const logEntry = [
        `[${timestamp}] === MCP Server Started ===`,
        `Process ID: ${process.pid}`,
        `Node Version: ${process.version}`,
        `Log Mode: ${process.env.PLAYWRIGHT_MCP_LOG_REQUESTS || 'debug only'}`,
        '---',
      ].join('\n');

      appendFileSync(LOG_FILE, `${logEntry}\n`, 'utf-8');
      requestDebug('Request logging to file enabled: %s', LOG_FILE);
    }
  } catch (error) {
    requestDebug('Failed to log server start: %o', error);
  }
}
