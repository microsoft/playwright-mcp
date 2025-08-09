/**
 * Base tool handler to reduce code duplication in tool implementations
 *
 * This base class provides common patterns for:
 * - Expectation parameter handling
 * - Error handling and enrichment
 * - Response formatting
 * - Element reference resolution
 */

import { z } from 'zod';
import type { Response } from '../response.js';
import { expectationSchema } from '../schemas/expectation.js';
import type { Tab } from '../tab.js';
import { getErrorMessage } from '../utils/commonFormatters.js';

// Common schema patterns used across tools
export const baseElementSchema = z.object({
  element: z
    .string()
    .optional()
    .describe(
      'Human-readable element description used to obtain permission to interact with the element'
    ),
  ref: z
    .string()
    .optional()
    .describe('Exact target element reference from the page snapshot'),
});

export const baseExpectationSchema = z.object({
  expectation: expectationSchema,
});

// Common tool parameter patterns
export type BaseToolParams = z.infer<typeof baseExpectationSchema>;
export type ElementToolParams = z.infer<typeof baseElementSchema> &
  BaseToolParams;

/**
 * Abstract base class for tool handlers
 */
export abstract class BaseToolHandler<TParams extends BaseToolParams> {
  protected readonly toolName: string;

  constructor(toolName: string) {
    this.toolName = toolName;
  }

  /**
   * Main handler entry point - provides common error handling wrapper
   */
  async handle(tab: Tab, params: TParams, response: Response): Promise<void> {
    try {
      // Apply common expectation handling
      this.handleExpectation(params, response);

      // Execute the tool-specific logic
      await this.executeToolLogic(tab, params, response);
    } catch (error) {
      this.handleToolError(error, response, params);
      throw error; // Re-throw to maintain existing error propagation behavior
    }
  }

  /**
   * Abstract method for tool-specific implementation
   */
  protected abstract executeToolLogic(
    tab: Tab,
    params: TParams,
    response: Response
  ): Promise<void>;

  /**
   * Common expectation handling logic
   */
  protected handleExpectation(params: TParams, response: Response): void {
    // Default expectation handling - can be overridden by specific tools
    if (params.expectation) {
      // Apply expectation-based response configuration
      this.applyExpectationToResponse(params.expectation, response);
    }
  }

  /**
   * Apply expectation parameters to response configuration
   */
  protected applyExpectationToResponse(
    expectation: NonNullable<TParams['expectation']>,
    response: Response
  ): void {
    // Include snapshot if specified or if not explicitly set to false
    const exp = expectation as { includeSnapshot?: boolean };
    if (exp.includeSnapshot !== false) {
      response.setIncludeSnapshot();
    }

    // Apply other expectation configurations as needed
    // This can be extended based on common patterns found in tools
  }

  /**
   * Common error handling for tools
   */
  protected handleToolError(
    error: unknown,
    response: Response,
    params: TParams
  ): void {
    const errorMessage = getErrorMessage(error);

    // Add error context to response
    response.addError(`Error in ${this.toolName}: ${errorMessage}`);

    // Add debugging information if available
    if ('element' in params && params.element) {
      response.addResult(`Element context: ${params.element}`);
    }

    if ('ref' in params && params.ref) {
      response.addResult(`Reference: ${params.ref}`);
    }
  }

  /**
   * Helper method to generate consistent code comments
   */
  protected addCodeComment(
    response: Response,
    operation: string,
    context?: string
  ): void {
    const comment = context
      ? `// ${operation} - ${context}`
      : `// ${operation}`;
    response.addCode(comment);
  }

  /**
   * Helper method to wait for completion with consistent error handling
   */
  protected async waitForCompletion(
    tab: Tab,
    operation: () => Promise<void>,
    operationName?: string
  ): Promise<void> {
    try {
      await tab.waitForCompletion(operation);
    } catch (error) {
      const operation_name = operationName ?? 'operation';
      throw new Error(
        `${this.toolName} ${operation_name} failed: ${getErrorMessage(error)}`
      );
    }
  }
}

/**
 * Base class for tools that work with page elements
 */
export abstract class BaseElementToolHandler<
  TParams extends ElementToolParams,
> extends BaseToolHandler<TParams> {
  /**
   * Resolve element locator from params
   */
  async resolveElementLocator(
    tab: Tab,
    params: TParams
  ): Promise<import('playwright').Locator | undefined> {
    if (params.ref && params.element) {
      return await tab.refLocator({
        ref: params.ref,
        element: params.element,
      });
    }
  }

  /**
   * Validate element parameters
   */
  validateElementParams(params: TParams): void {
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
   * Enhanced error handling for element-specific operations
   */
  protected handleToolError(
    error: unknown,
    response: Response,
    params: TParams
  ): void {
    super.handleToolError(error, response, params);

    // Add element-specific debugging suggestions
    if (params.element && params.ref) {
      response.addResult('Suggestion: Verify element selector is still valid');
      response.addResult(
        'Suggestion: Check if element is visible and interactable'
      );
    }
  }
}

/**
 * Factory function to create tool definitions with base handler
 */
export function createToolWithBaseHandler<TParams extends BaseToolParams>(
  config: {
    name: string;
    title: string;
    description: string;
    inputSchema: z.ZodType<TParams>;
    capability?: string;
    type?: 'readOnly' | 'destructive';
  },
  handlerClass: new (toolName: string) => BaseToolHandler<TParams>
) {
  const handler = new handlerClass(config.name);

  return {
    capability: config.capability ?? 'core',
    schema: {
      name: config.name,
      title: config.title,
      description: config.description,
      inputSchema: config.inputSchema,
      type: config.type ?? 'readOnly',
    },
    handle: async (tab: Tab, params: TParams, response: Response) => {
      await handler.handle(tab, params, response);
    },
  };
}

/**
 * Utility schemas for common tool parameter combinations
 */
export const mouseCoordinateSchema = baseExpectationSchema.extend({
  x: z.number().describe('X coordinate'),
  y: z.number().describe('Y coordinate'),
});

export const navigationSchema = baseExpectationSchema.extend({
  url: z.string().describe('The URL to navigate to'),
});

export const keyboardSchema = baseExpectationSchema.extend({
  key: z.string().describe('Key to press'),
});

export type MouseCoordinateParams = z.infer<typeof mouseCoordinateSchema>;
export type NavigationParams = z.infer<typeof navigationSchema>;
export type KeyboardParams = z.infer<typeof keyboardSchema>;
