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

import type { ImageContent, TextContent } from '@modelcontextprotocol/sdk/types';
import type { JsonSchema7Type } from 'zod-to-json-schema';
import type { Context } from '../context';
import type * as playwright from 'playwright';
export type ToolCapability = 'core' | 'tabs' | 'pdf' | 'history' | 'wait' | 'files' | 'install';

export type ToolSchema = {
  name: string;
  description: string;
  inputSchema: JsonSchema7Type;
};

export type FileUploadModalState = {
  type: 'fileChooser';
  description: string;
  fileChooser: playwright.FileChooser;
};

export type DialogModalState = {
  type: 'dialog';
  description: string;
  dialog: playwright.Dialog;
};

export type ModalState = FileUploadModalState | DialogModalState;

export type ToolActionResult = { content?: (ImageContent | TextContent)[] } | undefined | void;

export type ToolResult = {
  code: string[];
  action?: () => Promise<ToolActionResult>;
  captureSnapshot: boolean;
  waitForNetwork: boolean;
  resultOverride?: ToolActionResult;
};

export type Tool = {
  capability: ToolCapability;
  schema: ToolSchema;
  clearsModalState?: ModalState['type'];
  handle: (context: Context, params?: Record<string, any>) => Promise<ToolResult>;
};

export type ToolFactory = (snapshot: boolean) => Tool;
