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

import { z } from 'zod';

/**
 * Schema for diff options configuration
 */
export const diffOptionsSchema = z.object({
  enabled: z.boolean().default(false),
  threshold: z.number().min(0).max(1).default(0.1),
  format: z.enum(['unified', 'split', 'minimal']).default('unified'),
  maxDiffLines: z.number().positive().default(50),
  ignoreWhitespace: z.boolean().default(true),
  context: z.number().min(0).default(3)
}).optional();

/**
 * Schema for expectation configuration that controls response content
 */
export const expectationSchema = z.object({
  includeSnapshot: z.boolean().optional().default(true),
  includeConsole: z.boolean().optional().default(true),
  includeDownloads: z.boolean().optional().default(true),
  includeTabs: z.boolean().optional().default(true),
  includeCode: z.boolean().optional().default(true),
  snapshotOptions: z.object({
    selector: z.string().optional().describe('CSS selector to limit snapshot scope'),
    maxLength: z.number().optional().describe('Maximum characters for snapshot'),
    format: z.enum(['aria', 'text', 'html']).optional().default('aria')
  }).optional(),
  consoleOptions: z.object({
    levels: z.array(z.enum(['log', 'warn', 'error', 'info'])).optional(),
    maxMessages: z.number().optional().default(10),
    patterns: z.array(z.string()).optional().describe('Regex patterns to filter messages'),
    removeDuplicates: z.boolean().optional().default(false).describe('Remove duplicate messages')
  }).optional(),
  imageOptions: z.object({
    quality: z.number().min(1).max(100).optional().describe('JPEG quality (1-100)'),
    maxWidth: z.number().optional().describe('Maximum width in pixels'),
    maxHeight: z.number().optional().describe('Maximum height in pixels'),
    format: z.enum(['jpeg', 'png', 'webp']).optional()
  }).optional(),
  diffOptions: diffOptionsSchema
}).optional();

export type ExpectationOptions = z.infer<typeof expectationSchema>;

/**
 * Tool-specific default expectation configurations
 * These optimize token usage based on typical tool usage patterns
 */
const TOOL_DEFAULTS: Record<string, Required<Omit<NonNullable<ExpectationOptions>, 'snapshotOptions' | 'consoleOptions' | 'imageOptions' | 'diffOptions'>>> = {
  // Navigation tools need full context for verification
  browser_navigate: {
    includeSnapshot: true,
    includeConsole: true,
    includeDownloads: true,
    includeTabs: true,
    includeCode: true
  },

  // Interactive tools need snapshot for feedback but less verbose logging
  browser_click: {
    includeSnapshot: true,
    includeConsole: false,
    includeDownloads: false,
    includeTabs: false,
    includeCode: true
  },

  browser_type: {
    includeSnapshot: true,
    includeConsole: false,
    includeDownloads: false,
    includeTabs: false,
    includeCode: true
  },

  // Screenshot tools don't need additional context
  browser_take_screenshot: {
    includeSnapshot: false,
    includeConsole: false,
    includeDownloads: false,
    includeTabs: false,
    includeCode: false
  },

  // Snapshot tool should capture snapshot but minimal other context
  browser_snapshot: {
    includeSnapshot: true,
    includeConsole: false,
    includeDownloads: false,
    includeTabs: false,
    includeCode: false
  },

  // Code evaluation needs console output but minimal other info
  browser_evaluate: {
    includeSnapshot: false,
    includeConsole: true,
    includeDownloads: false,
    includeTabs: false,
    includeCode: true
  },

  // Wait operations typically don't need verbose output
  browser_wait_for: {
    includeSnapshot: false,
    includeConsole: false,
    includeDownloads: false,
    includeTabs: false,
    includeCode: true
  }
};

/**
 * General default configuration for tools without specific settings
 */
const GENERAL_DEFAULT: Required<Omit<NonNullable<ExpectationOptions>, 'snapshotOptions' | 'consoleOptions' | 'imageOptions' | 'diffOptions'>> = {
  includeSnapshot: true,
  includeConsole: true,
  includeDownloads: true,
  includeTabs: true,
  includeCode: true
};

/**
 * Get default expectation configuration for a specific tool
 * @param toolName - Name of the tool (e.g., 'click', 'navigate', 'screenshot')
 * @returns Default expectation configuration optimized for the tool
 */
export function getDefaultExpectation(toolName: string): Required<Omit<NonNullable<ExpectationOptions>, 'snapshotOptions' | 'consoleOptions' | 'imageOptions' | 'diffOptions'>> {
  return TOOL_DEFAULTS[toolName] || GENERAL_DEFAULT;
}

/**
 * Merge user-provided expectation with tool-specific defaults
 * @param toolName - Name of the tool
 * @param userExpectation - User-provided expectation options
 * @returns Merged expectation configuration
 */
export function mergeExpectations(
  toolName: string,
  userExpectation?: ExpectationOptions
): NonNullable<ExpectationOptions> {
  const defaults = getDefaultExpectation(toolName);

  if (!userExpectation)
    return defaults;


  return {
    includeSnapshot: userExpectation.includeSnapshot ?? defaults.includeSnapshot,
    includeConsole: userExpectation.includeConsole ?? defaults.includeConsole,
    includeDownloads: userExpectation.includeDownloads ?? defaults.includeDownloads,
    includeTabs: userExpectation.includeTabs ?? defaults.includeTabs,
    includeCode: userExpectation.includeCode ?? defaults.includeCode,
    snapshotOptions: userExpectation.snapshotOptions,
    consoleOptions: userExpectation.consoleOptions,
    imageOptions: userExpectation.imageOptions,
    diffOptions: userExpectation.diffOptions
  };
}
