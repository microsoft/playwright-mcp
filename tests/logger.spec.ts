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

import { test, expect } from "./fixtures";
import {
  Logger,
  getLogger,
  setGlobalLogger,
  resetGlobalLogger,
  PerformanceTimer,
  LogEntry,
  type LogContext,
} from "../src/logger";

test("logger - text format outputs human-readable logs", () => {
  const logs: string[] = [];
  const logger = new Logger({
    format: "text",
    level: "info",
    write: (line) => logs.push(line),
  });

  logger.info("Test message", { userId: "123", action: "login" });

  expect(logs.length).toBe(1);
  expect(logs[0]).toContain("[INFO]");
  expect(logs[0]).toContain("Test message");
  expect(logs[0]).toContain("userId=123");
  expect(logs[0]).toContain("action=login");
});

test("logger - json format outputs valid JSON", () => {
  const logs: string[] = [];
  const logger = new Logger({
    format: "json",
    level: "info",
    write: (line) => logs.push(line),
  });

  logger.info("Test message", { userId: "123" });

  expect(logs.length).toBe(1);
  const parsed: LogEntry = JSON.parse(logs[0]);
  expect(parsed.level).toBe("info");
  expect(parsed.message).toBe("Test message");
  expect(parsed.context?.userId).toBe("123");
  expect(parsed.timestamp).toBeDefined();
  expect(parsed.sessionId).toBeDefined();
});

test("logger - respects log level filtering", () => {
  const logs: string[] = [];
  const logger = new Logger({
    format: "text",
    level: "warn",
    write: (line) => logs.push(line),
  });

  logger.debug("Debug message");
  logger.info("Info message");
  logger.warn("Warn message");
  logger.error("Error message");

  // Only warn and error should be logged
  expect(logs.length).toBe(2);
  expect(logs[0]).toContain("Warn message");
  expect(logs[1]).toContain("Error message");
});

test("logger - debug level includes all messages", () => {
  const logs: string[] = [];
  const logger = new Logger({
    format: "text",
    level: "debug",
    write: (line) => logs.push(line),
  });

  logger.debug("Debug");
  logger.info("Info");
  logger.warn("Warn");
  logger.error("Error");

  expect(logs.length).toBe(4);
});

test("logger - includes session ID in all entries", () => {
  const logs: string[] = [];
  const sessionId = "test-session-123";
  const logger = new Logger({
    format: "json",
    sessionId,
    write: (line) => logs.push(line),
  });

  logger.info("Message 1");
  logger.warn("Message 2");

  const parsed1: LogEntry = JSON.parse(logs[0]);
  const parsed2: LogEntry = JSON.parse(logs[1]);

  expect(parsed1.sessionId).toBe(sessionId);
  expect(parsed2.sessionId).toBe(sessionId);
});

test("logger - tool invocation logs with success", () => {
  const logs: string[] = [];
  const logger = new Logger({
    format: "json",
    write: (line) => logs.push(line),
  });

  logger.toolInvocation("browser_click", 125, true);

  expect(logs.length).toBe(1);
  const parsed: LogEntry = JSON.parse(logs[0]);
  expect(parsed.message).toContain("browser_click");
  expect(parsed.context?.tool).toBe("browser_click");
  expect(parsed.context?.durationMs).toBe(125);
  expect(parsed.context?.status).toBe("success");
  expect(parsed.level).toBe("info");
});

test("logger - tool invocation logs with error", () => {
  const logs: string[] = [];
  const logger = new Logger({
    format: "json",
    write: (line) => logs.push(line),
  });

  logger.toolInvocation("browser_navigate", 500, false, "Navigation timeout");

  expect(logs.length).toBe(1);
  const parsed: LogEntry = JSON.parse(logs[0]);
  expect(parsed.level).toBe("error");
  expect(parsed.context?.status).toBe("error");
  expect(parsed.context?.error).toBe("Navigation timeout");
});

test("logger - browser event logging", () => {
  const logs: string[] = [];
  const logger = new Logger({
    format: "json",
    write: (line) => logs.push(line),
  });

  logger.browserEvent("launch", { browserType: "chromium" });
  logger.browserEvent("navigate", { url: "https://example.com" });
  logger.browserEvent("close", { reason: "session_end" });

  expect(logs.length).toBe(3);

  const launch: LogEntry = JSON.parse(logs[0]);
  expect(launch.context?.event).toBe("launch");
  expect(launch.context?.browserType).toBe("chromium");

  const navigate: LogEntry = JSON.parse(logs[1]);
  expect(navigate.context?.event).toBe("navigate");
  expect(navigate.context?.url).toBe("https://example.com");

  const close: LogEntry = JSON.parse(logs[2]);
  expect(close.context?.event).toBe("close");
});

test("logger - error level uses stderr", () => {
  const stdoutLogs: string[] = [];
  const stderrLogs: string[] = [];

  const logger = new Logger({
    format: "text",
    write: (line, isError) => {
      if (isError) {
        stderrLogs.push(line);
      } else {
        stdoutLogs.push(line);
      }
    },
  });

  logger.info("Info message");
  logger.warn("Warn message");
  logger.error("Error message");

  expect(stdoutLogs.length).toBe(2);
  expect(stderrLogs.length).toBe(1);
  expect(stderrLogs[0]).toContain("Error message");
});

test("logger - includes timestamp in ISO format", () => {
  const logs: string[] = [];
  const logger = new Logger({
    format: "json",
    write: (line) => logs.push(line),
  });

  logger.info("Test");

  const parsed: LogEntry = JSON.parse(logs[0]);
  const timestamp = new Date(parsed.timestamp);
  expect(timestamp.getTime()).toBeGreaterThan(0);
  expect(parsed.timestamp).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
});

test("logger - context is optional", () => {
  const logs: string[] = [];
  const logger = new Logger({
    format: "json",
    write: (line) => logs.push(line),
  });

  logger.info("Message without context");

  const parsed: LogEntry = JSON.parse(logs[0]);
  expect(parsed.context).toBeUndefined();
  expect(parsed.message).toBe("Message without context");
});

test("logger - log level environment variable", () => {
  const savedEnv = process.env.LOG_LEVEL;

  try {
    process.env.LOG_LEVEL = "error";
    const logger = Logger.fromEnvironment();

    const logs: string[] = [];
    (logger as any).write = (line: string) => logs.push(line);

    logger.info("Should not appear");
    logger.error("Should appear");

    expect(logs.length).toBe(1);
    expect(logs[0]).toContain("Should appear");
  } finally {
    if (savedEnv) {
      process.env.LOG_LEVEL = savedEnv;
    } else {
      delete process.env.LOG_LEVEL;
    }
  }
});

test("logger - log format environment variable", () => {
  const savedEnv = process.env.LOG_FORMAT;

  try {
    process.env.LOG_FORMAT = "json";
    const logger = Logger.fromEnvironment();

    const logs: string[] = [];
    (logger as any).write = (line: string) => logs.push(line);

    logger.info("Test");

    const parsed: LogEntry = JSON.parse(logs[0]);
    expect(parsed.level).toBe("info");
  } finally {
    if (savedEnv) {
      process.env.LOG_FORMAT = savedEnv;
    } else {
      delete process.env.LOG_FORMAT;
    }
  }
});

test("logger - global logger instance", () => {
  resetGlobalLogger();

  const logger1 = getLogger();
  const logger2 = getLogger();

  expect(logger1).toBe(logger2);
  expect(logger1.getSessionId()).toBe(logger2.getSessionId());
});

test("logger - custom global logger", () => {
  const customLogger = new Logger({ format: "json", level: "debug" });
  setGlobalLogger(customLogger);

  const retrieved = getLogger();
  expect(retrieved).toBe(customLogger);

  resetGlobalLogger();
});

test("logger - performance timer measures elapsed time", async () => {
  const timer = new PerformanceTimer("async operation");

  await new Promise((resolve) => setTimeout(resolve, 50));

  const elapsed = timer.elapsed();
  expect(elapsed).toBeGreaterThanOrEqual(40);
  expect(elapsed).toBeLessThan(200);
});

test("logger - performance timer logs with context", () => {
  const logs: string[] = [];
  const logger = new Logger({
    level: "debug",
    format: "json",
    write: (line) => logs.push(line),
  });

  const timer = new PerformanceTimer("test operation");

  setTimeout(() => {
    timer.log(logger, { component: "test" });
  }, 10);

  // Give it time to execute
  return new Promise((resolve) => {
    setTimeout(() => {
      expect(logs.length).toBeGreaterThan(0);
      const parsed: LogEntry = JSON.parse(logs[0]);
      expect(parsed.message).toContain("test operation");
      expect(parsed.context?.operation).toBe("test operation");
      expect(parsed.context?.durationMs).toBeGreaterThan(0);
      expect(parsed.context?.component).toBe("test");
      resolve(undefined);
    }, 50);
  });
});

test("logger - multiple context fields", () => {
  const logs: string[] = [];
  const logger = new Logger({
    format: "json",
    write: (line) => logs.push(line),
  });

  const context: LogContext = {
    userId: 123,
    sessionId: "abc",
    duration: 456,
    success: true,
    path: "/api/test",
  };

  logger.info("Complex context", context);

  const parsed: LogEntry = JSON.parse(logs[0]);
  expect(parsed.context).toEqual(context);
});

test("logger - text format with multiple context fields", () => {
  const logs: string[] = [];
  const logger = new Logger({
    format: "text",
    write: (line) => logs.push(line),
  });

  logger.info("Test", { userId: "123", action: "create", status: "pending" });

  expect(logs[0]).toContain("[INFO]");
  expect(logs[0]).toContain("Test");
  expect(logs[0]).toContain("userId=123");
  expect(logs[0]).toContain("action=create");
  expect(logs[0]).toContain("status=pending");
});
