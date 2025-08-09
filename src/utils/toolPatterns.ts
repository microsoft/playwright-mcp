/**
 * Common tool patterns to reduce code duplication
 *
 * This module provides utility functions for common patterns found across tools,
 * without requiring major refactoring of existing tool implementations.
 */

import type * as playwright from 'playwright';
import type { Response } from '../response.js';
import type { Tab } from '../tab.js';
import { getErrorMessage } from './commonFormatters.js';

/**
 * Common element locator resolution pattern
 * Used across multiple tools that work with elements
 */
export async function resolveElementLocator(
  tab: Tab,
  params: {
    element?: string;
    ref?: string;
  }
): Promise<playwright.Locator | undefined> {
  if (params.ref && params.element) {
    return await tab.refLocator({
      ref: params.ref,
      element: params.element,
    });
  }
}

/**
 * Common element parameter validation
 * Ensures element and ref are provided together
 */
export function validateElementParams(params: {
  element?: string;
  ref?: string;
}): void {
  if (params.ref && !params.element) {
    throw new Error('Element description is required when ref is provided');
  }

  if (params.element && !params.ref) {
    throw new Error(
      'Element ref is required when element description is provided'
    );
  }
}

/**
 * Enhanced error context for tool operations
 * Adds consistent error information to responses
 */
export function addToolErrorContext(
  response: Response,
  error: unknown,
  toolName: string,
  params?: {
    element?: string;
    ref?: string;
    [key: string]: unknown;
  }
): void {
  const errorMessage = getErrorMessage(error);
  response.addError(`Error in ${toolName}: ${errorMessage}`);

  if (params?.element) {
    response.addResult(`Element context: ${params.element}`);
  }

  if (params?.ref) {
    response.addResult(`Reference: ${params.ref}`);
  }
}

/**
 * Common expectation handling patterns
 * Applied to response based on common tool needs
 */
export function applyCommonExpectations(
  response: Response,
  expectation?: {
    includeSnapshot?: boolean;
    [key: string]: unknown;
  }
): void {
  // Default to including snapshot unless explicitly disabled
  if (expectation?.includeSnapshot !== false) {
    response.setIncludeSnapshot();
  }
}

/**
 * Common wait for completion pattern with enhanced error handling
 */
export async function waitForToolCompletion(
  tab: Tab,
  operation: () => Promise<void>,
  toolName: string,
  operationName?: string
): Promise<void> {
  try {
    await tab.waitForCompletion(operation);
  } catch (error) {
    const opName = operationName ?? 'operation';
    throw new Error(`${toolName} ${opName} failed: ${getErrorMessage(error)}`);
  }
}

/**
 * Generate consistent operation comments for code output
 */
export function addOperationComment(
  response: Response,
  operation: string,
  context?: string
): void {
  const comment = context ? `// ${operation} - ${context}` : `// ${operation}`;
  response.addCode(comment);
}

/**
 * Common mouse operation patterns
 */
export interface MouseOperationParams {
  x: number;
  y: number;
  element?: string;
}

export function addMouseOperationComment(
  response: Response,
  operation: string,
  params: MouseOperationParams
): void {
  if (params.element) {
    addOperationComment(response, operation, `on ${params.element}`);
  } else {
    addOperationComment(response, operation, `at (${params.x}, ${params.y})`);
  }
}

/**
 * Common navigation operation patterns
 */
export function addNavigationComment(
  response: Response,
  operation: string,
  url?: string
): void {
  if (url) {
    addOperationComment(response, operation, `to ${url}`);
  } else {
    addOperationComment(response, operation);
  }
}

/**
 * Handle tool operation with common error patterns
 */
export async function executeToolOperation<T>(
  operation: () => Promise<T>,
  toolName: string,
  response: Response,
  params?: Record<string, unknown>
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    addToolErrorContext(response, error, toolName, params);
    throw error;
  }
}

/**
 * Common pattern for setting up tool responses
 */
export function setupToolResponse(
  response: Response,
  params: {
    expectation?: { includeSnapshot?: boolean; [key: string]: unknown };
    [key: string]: unknown;
  }
): void {
  applyCommonExpectations(response, params.expectation);
}

/**
 * Validate and resolve element for tool operations
 * Combines validation and locator resolution
 */
export async function validateAndResolveElement(
  tab: Tab,
  params: {
    element?: string;
    ref?: string;
  }
): Promise<playwright.Locator | undefined> {
  validateElementParams(params);
  return await resolveElementLocator(tab, params);
}

/**
 * Common patterns for different tool categories
 */
export const ToolPatterns = {
  // Mouse operation helpers
  Mouse: {
    addComment: addMouseOperationComment,
    validate: (params: MouseOperationParams) => {
      if (params.x < 0 || params.y < 0) {
        throw new Error('Mouse coordinates must be non-negative');
      }
    },
  },

  // Navigation helpers
  Navigation: {
    addComment: addNavigationComment,
    validateUrl: (url: string) => {
      try {
        new URL(url);
      } catch {
        throw new Error(`Invalid URL: ${url}`);
      }
    },
  },

  // Element interaction helpers
  Element: {
    validateAndResolve: validateAndResolveElement,
    addErrorContext: (
      response: Response,
      error: unknown,
      toolName: string,
      element?: string
    ) => {
      const errorMsg = getErrorMessage(error);
      response.addResult(`${toolName} failed: ${errorMsg}`);
      if (element) {
        response.addResult(`Target element: ${element}`);
        response.addResult(
          'Suggestion: Verify element is visible and interactable'
        );
      }
    },
  },
} as const;
