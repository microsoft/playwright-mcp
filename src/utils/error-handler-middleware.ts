/**
 * Error handling middleware to reduce duplicate error handling patterns
 */

import { getErrorMessage } from './common-formatters.js';
import { errorHandlerDebug } from './log.js';

/**
 * Common error handling wrapper for async operations
 */
export async function withErrorHandling<T>(
  operation: () => Promise<T> | T,
  context?: {
    operationName?: string;
    component?: string;
    onError?: (error: Error) => void;
  }
): Promise<T> {
  try {
    const result = await operation();
    return result;
  } catch (error) {
    const message = getErrorMessage(error);
    const contextInfo = context
      ? `[${context.component || 'Unknown'}:${
          context.operationName || 'operation'
        }]`
      : '[Unknown:operation]';

    const enrichedError = new Error(`${contextInfo} ${message}`);
    enrichedError.cause = error;

    // Optional custom error handler
    if (context?.onError) {
      context.onError(enrichedError);
    }

    throw enrichedError;
  }
}

/**
 * Synchronous error handling wrapper
 */
export function withErrorHandlingSync<T>(
  operation: () => T,
  context?: {
    operationName?: string;
    component?: string;
    onError?: (error: Error) => void;
  }
): T {
  try {
    return operation();
  } catch (error) {
    const message = getErrorMessage(error);
    const contextInfo = context
      ? `[${context.component || 'Unknown'}:${
          context.operationName || 'operation'
        }]`
      : '[Unknown:operation]';

    const enrichedError = new Error(`${contextInfo} ${message}`);
    enrichedError.cause = error;

    // Optional custom error handler
    if (context?.onError) {
      context.onError(enrichedError);
    }

    throw enrichedError;
  }
}

/**
 * Error handler for batch operations
 */
export function createBatchErrorHandler(componentName: string) {
  return (error: Error, stepName?: string) => {
    const message = getErrorMessage(error);
    const step = stepName ? ` (step: ${stepName})` : '';
    return new Error(
      `[${componentName}] Batch operation failed${step}: ${message}`
    );
  };
}

/**
 * Create a standardized error reporter
 */
export function createErrorReporter(component: string) {
  return {
    reportAndThrow(error: unknown, operation: string): never {
      const message = getErrorMessage(error);
      throw new Error(`[${component}:${operation}] ${message}`);
    },

    reportWarning(error: unknown, operation: string): void {
      const message = getErrorMessage(error);
      errorHandlerDebug(`[${component}:${operation}] Warning: ${message}`);
    },
  };
}
