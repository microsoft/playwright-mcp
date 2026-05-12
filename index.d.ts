#!/usr/bin/env node
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

import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import type { Config } from "./config";
import type { BrowserContext } from "playwright";

export declare function createConnection(
  config?: Config,
  contextGetter?: () => Promise<BrowserContext>,
): Promise<Server>;

export type { AuthenticatedServerOptions } from "./src/server";
export type { HealthMetrics, HealthStatus, LogTailEntry } from "./src/server";
export declare function createAuthenticatedHandler(
  connection: Server,
  options?: {
    authToken?: string;
    messagePath?: string;
    logger?: (message: string) => void;
    version?: string;
    capabilities?: Record<string, boolean>;
    browsers?: Record<string, "ready" | "unavailable">;
    config?: Record<string, any>;
    enableDashboard?: boolean;
  },
): (
  req: import("http").IncomingMessage,
  res: import("http").ServerResponse,
) => void;
export declare function validateServerConfiguration(
  port: number | undefined,
  authToken: string | undefined,
  logger?: (message: string) => void,
  host?: string,
): void;

export type {
  LogLevel,
  LogContext,
  LogEntry,
  LoggerOptions,
} from "./src/logger";
export {
  Logger,
  getLogger,
  setGlobalLogger,
  resetGlobalLogger,
  PerformanceTimer,
} from "./src/logger";
