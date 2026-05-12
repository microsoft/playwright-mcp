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

import { randomUUID } from "crypto";

/**
 * Log level enumeration
 */
export type LogLevel = "debug" | "info" | "warn" | "error";

/**
 * Context data that can be included in log entries
 */
export interface LogContext {
  [key: string]: string | number | boolean | undefined;
}

/**
 * Structured log entry
 */
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  sessionId: string;
  context?: LogContext;
}

/**
 * Logger options
 */
export interface LoggerOptions {
  /**
   * Minimum log level to emit. Default: "info"
   */
  level?: LogLevel;

  /**
   * Output format: "json" for JSON lines, "text" for human-readable. Default: "text"
   */
  format?: "json" | "text";

  /**
   * Session ID to use for all log entries. If not provided, a random UUID is generated.
   */
  sessionId?: string;

  /**
   * Custom write function. Default: console.log / console.error
   */
  write?: (line: string, isError?: boolean) => void;
}

/**
 * Log level severity (higher number = more severe)
 */
const LOG_LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/**
 * Structured logger with JSON and text output support
 */
export class Logger {
  private level: LogLevel;
  private format: "json" | "text";
  private sessionId: string;
  private write: (line: string, isError?: boolean) => void;

  constructor(options: LoggerOptions = {}) {
    this.level = options.level || "info";
    this.format = options.format || "text";
    this.sessionId = options.sessionId || randomUUID();
    this.write = options.write || this.defaultWrite;
  }

  /**
   * Default write function that uses console
   */
  private defaultWrite = (line: string, isError = false) => {
    if (isError) {
      console.error(line);
    } else {
      console.log(line);
    }
  };

  /**
   * Checks if a log level should be emitted
   */
  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVEL_ORDER[level] >= LOG_LEVEL_ORDER[this.level];
  }

  /**
   * Formats a log entry
   */
  private formatEntry(entry: LogEntry): string {
    if (this.format === "json") {
      return JSON.stringify(entry);
    }

    // Text format: [LEVEL] timestamp | message (context)
    const contextStr =
      entry.context && Object.keys(entry.context).length > 0
        ? ` | ${Object.entries(entry.context)
            .map(([k, v]) => `${k}=${v}`)
            .join(" ")}`
        : "";

    return `[${entry.level.toUpperCase()}] ${entry.timestamp} | ${entry.message}${contextStr}`;
  }

  /**
   * Emits a log entry
   */
  private emit(level: LogLevel, message: string, context?: LogContext) {
    if (!this.shouldLog(level)) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      sessionId: this.sessionId,
      ...(context && { context }),
    };

    const formatted = this.formatEntry(entry);
    this.write(formatted, level === "error");
  }

  /**
   * Logs a debug message
   */
  debug(message: string, context?: LogContext) {
    this.emit("debug", message, context);
  }

  /**
   * Logs an info message
   */
  info(message: string, context?: LogContext) {
    this.emit("info", message, context);
  }

  /**
   * Logs a warning message
   */
  warn(message: string, context?: LogContext) {
    this.emit("warn", message, context);
  }

  /**
   * Logs an error message
   */
  error(message: string, context?: LogContext) {
    this.emit("error", message, context);
  }

  /**
   * Logs a tool invocation
   */
  toolInvocation(
    toolName: string,
    durationMs: number,
    success: boolean,
    errorMessage?: string,
  ) {
    const context: LogContext = {
      tool: toolName,
      durationMs,
      status: success ? "success" : "error",
    };

    if (errorMessage) {
      context.error = errorMessage;
    }

    this.emit(success ? "info" : "error", `Tool invoked: ${toolName}`, context);
  }

  /**
   * Logs browser lifecycle events
   */
  browserEvent(event: "launch" | "navigate" | "close", details?: LogContext) {
    const context: LogContext = { event, ...details };
    this.info(`Browser ${event}`, context);
  }

  /**
   * Creates a child logger with additional context
   */
  withContext(additionalContext: LogContext): Logger {
    // This could be enhanced to automatically include context in all child logs
    const childLogger = new Logger({
      level: this.level,
      format: this.format,
      sessionId: this.sessionId,
      write: this.write,
    });

    // Store context for later use
    (childLogger as any).additionalContext = additionalContext;

    return childLogger;
  }

  /**
   * Gets the current session ID
   */
  getSessionId(): string {
    return this.sessionId;
  }

  /**
   * Creates a logger from environment variables
   */
  static fromEnvironment(): Logger {
    const format = process.env.LOG_FORMAT === "json" ? "json" : "text";
    const level = (process.env.LOG_LEVEL || "info") as LogLevel;

    return new Logger({ format, level });
  }
}

/**
 * Creates a global logger instance (singleton-like)
 */
let globalLogger: Logger | undefined;

/**
 * Gets or creates the global logger
 */
export function getLogger(): Logger {
  if (!globalLogger) {
    globalLogger = Logger.fromEnvironment();
  }
  return globalLogger;
}

/**
 * Sets the global logger (useful for testing)
 */
export function setGlobalLogger(logger: Logger) {
  globalLogger = logger;
}

/**
 * Resets the global logger to default
 */
export function resetGlobalLogger() {
  globalLogger = undefined;
}

/**
 * Performance timer for measuring operation duration
 */
export class PerformanceTimer {
  private startTime: number;
  private label: string;

  constructor(label: string) {
    this.startTime = performance.now();
    this.label = label;
  }

  /**
   * Gets the elapsed time in milliseconds
   */
  elapsed(): number {
    return Math.round(performance.now() - this.startTime);
  }

  /**
   * Logs the elapsed time
   */
  log(logger: Logger, context?: LogContext) {
    const elapsed = this.elapsed();
    logger.debug(`${this.label} completed in ${elapsed}ms`, {
      operation: this.label,
      durationMs: elapsed,
      ...context,
    });
  }
}
