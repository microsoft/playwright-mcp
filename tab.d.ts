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

import type * as playwright from 'playwright';

/**
 * Page snapshot type definition
 */
export type PageSnapshot = {
  text(): string;
  refLocator(params: { element: string; ref: string }): playwright.Locator;
};

/**
 * Context type definition (forward reference to avoid circular dependency)
 */
export type Context = {
  readonly tools: any[];
  readonly config: any;
  clientVersion?: { name: string; version: string };

  clientSupportsImages(): boolean;
  modalStates(): any[];
  setModalState(modalState: any, inTab: Tab): void;
  clearModalState(modalState: any): void;
  modalStatesMarkdown(): string[];
  tabs(): Tab[];
  currentTabOrDie(): Tab;
  newTab(): Promise<Tab>;
  selectTab(index: number): Promise<void>;
  ensureTab(): Promise<Tab>;
  listTabsMarkdown(): Promise<string>;
  closeTab(index: number | undefined): Promise<string>;
  run(tool: any, params: Record<string, unknown> | undefined): Promise<any>;
  waitForTimeout(time: number): Promise<void>;
  close(): Promise<void>;
};

/**
 * Tab class type definition
 */
export type Tab = {
  context: Context;
  page: playwright.Page;
  title(): Promise<string>;
  waitForLoadState(
    state: 'load',
    options?: { timeout?: number }
  ): Promise<void>;
  navigate(url: string): Promise<void>;
  hasSnapshot(): boolean;
  snapshotOrDie(): PageSnapshot;
  consoleMessages(): playwright.ConsoleMessage[];
  requests(): Map<playwright.Request, playwright.Response | null>;
  captureSnapshot(): Promise<void>;
};
