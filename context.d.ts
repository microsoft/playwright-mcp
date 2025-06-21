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

import type * as playwright from "playwright";
import type {
  ImageContent,
  TextContent,
} from "@modelcontextprotocol/sdk/types.js";
import type { Tab } from "./tab.js";

/**
 * Tool capability types
 */
export type ToolCapability =
  | "core"
  | "tabs"
  | "pdf"
  | "history"
  | "wait"
  | "files"
  | "install"
  | "testing";

/**
 * Configuration for the MCP server
 */
export type FullConfig = {
  browser: {
    browserAgent?: string;
    browserName: "chromium" | "firefox" | "webkit";
    isolated?: boolean;
    userDataDir?: string;
    launchOptions?: playwright.LaunchOptions;
    contextOptions?: playwright.BrowserContextOptions;
    cdpEndpoint?: string;
    remoteEndpoint?: string;
  };
  server?: {
    port?: number;
    host?: string;
  };
  capabilities?: ToolCapability[];
  vision?: boolean;
  saveTrace?: boolean;
  outputDir?: string;
  network?: {
    allowedOrigins?: string[];
    blockedOrigins?: string[];
  };
  imageResponses?: "allow" | "omit" | "auto";
};

/**
 * Modal state types for handling dialogs and file choosers
 */
export type FileUploadModalState = {
  type: "fileChooser";
  description: string;
  fileChooser: playwright.FileChooser;
};

export type DialogModalState = {
  type: "dialog";
  description: string;
  dialog: playwright.Dialog;
};

export type ModalState = FileUploadModalState | DialogModalState;

/**
 * Tool action result type
 */
export type ToolActionResult =
  | { content?: (ImageContent | TextContent)[] }
  | undefined
  | void;

/**
 * Tool result type
 */
export type ToolResult = {
  code: string[];
  action?: () => Promise<ToolActionResult>;
  captureSnapshot: boolean;
  waitForNetwork: boolean;
  resultOverride?: ToolActionResult;
};

/**
 * Tool schema type
 */
export type ToolSchema<Input = any> = {
  name: string;
  title: string;
  description: string;
  inputSchema: Input;
  type: "readOnly" | "destructive";
};

/**
 * Tool type definition
 */
export type Tool<Input = any> = {
  capability: ToolCapability;
  schema: ToolSchema<Input>;
  clearsModalState?: ModalState["type"];
  handle: (context: Context, params: any) => Promise<ToolResult>;
};

/**
 * Context class type definition
 */
export type Context = {
  readonly tools: Tool[];
  readonly config: FullConfig;
  clientVersion?: { name: string; version: string };

  clientSupportsImages(): boolean;
  modalStates(): ModalState[];
  setModalState(modalState: ModalState, inTab: Tab): void;
  clearModalState(modalState: ModalState): void;
  modalStatesMarkdown(): string[];
  tabs(): Tab[];
  currentTabOrDie(): Tab;
  newTab(): Promise<Tab>;
  selectTab(index: number): Promise<void>;
  ensureTab(): Promise<Tab>;
  listTabsMarkdown(): Promise<string>;
  closeTab(index: number | undefined): Promise<string>;
  run(
    tool: Tool,
    params: Record<string, unknown> | undefined
  ): Promise<{ content: (ImageContent | TextContent)[] }>;
  waitForTimeout(time: number): Promise<void>;
  close(): Promise<void>;
};
