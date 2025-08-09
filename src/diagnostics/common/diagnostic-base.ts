/**
 * Base class for diagnostic components providing common initialization and cleanup patterns
 */

import type * as playwright from 'playwright';

export interface IDisposable {
  dispose(): Promise<void>;
}

export abstract class DiagnosticBase implements IDisposable {
  private isDisposed = false;
  protected readonly componentName: string;
  protected readonly page: playwright.Page | null;

  constructor(page: playwright.Page | null, componentName: string) {
    this.page = page;
    this.componentName = componentName;
  }

  /**
   * Check if the component has been disposed
   * @throws Error if component is disposed
   */
  protected checkDisposed(): void {
    if (this.isDisposed) {
      throw new Error(`${this.componentName} has been disposed`);
    }
  }

  /**
   * Get validated page reference
   * @returns Valid playwright.Page instance
   * @throws Error if page is null or component is disposed
   */
  protected getPage(): playwright.Page {
    this.checkDisposed();
    if (!this.page) {
      throw new Error('Page reference is null');
    }
    return this.page;
  }

  /**
   * Check if component is disposed
   */
  getIsDisposed(): boolean {
    return this.isDisposed;
  }

  /**
   * Check if component is disposed (protected access for subclasses)
   */
  protected get disposed(): boolean {
    return this.isDisposed;
  }

  /**
   * Mark component as disposed
   */
  protected markDisposed(): void {
    this.isDisposed = true;
  }

  /**
   * Template method for component-specific disposal logic
   */
  protected abstract performDispose(): Promise<void>;

  /**
   * Common disposal implementation
   */
  async dispose(): Promise<void> {
    if (this.isDisposed) {
      return;
    }

    try {
      await this.performDispose();
    } catch (error) {
      diagnosticWarn(
        this.componentName,
        'dispose',
        'Failed to dispose component',
        error instanceof Error ? error : String(error)
      );
    } finally {
      this.markDisposed();
    }
  }
}

/**
 * Log warning message with consistent format
 */
export function diagnosticWarn(
  _component: string,
  _operation: string,
  _message: string,
  _error?: Error | string
): void {
  // Diagnostic warnings are handled silently
}

/**
 * Log error message with consistent format
 */
export function diagnosticError(
  _component: string,
  _operation: string,
  _message: string,
  _error?: Error | string
): void {
  // Diagnostic errors are handled silently
}

/**
 * Log info message with consistent format
 */
export function diagnosticInfo(
  _component: string,
  _operation: string,
  _message: string,
  _data?: Record<string, unknown> | string | number
): void {
  // Diagnostic info messages are handled silently
}

/**
 * Log debug message with consistent format
 */
export function diagnosticDebug(
  _component: string,
  _operation: string,
  _message: string,
  _data?: Record<string, unknown> | string | number
): void {
  // Diagnostic debug messages are handled silently
}

/**
 * Create operation-specific logger
 */
export function createDiagnosticLogger(component: string, operation: string) {
  return {
    warn: (message: string, error?: unknown) =>
      diagnosticWarn(
        component,
        operation,
        message,
        error instanceof Error ? error : String(error)
      ),
    error: (message: string, error?: unknown) =>
      diagnosticError(
        component,
        operation,
        message,
        error instanceof Error ? error : String(error)
      ),
    info: (message: string, data?: unknown) =>
      diagnosticInfo(
        component,
        operation,
        message,
        typeof data === 'object' && data !== null
          ? (data as Record<string, unknown>)
          : (data as string | number | undefined)
      ),
    debug: (message: string, data?: unknown) =>
      diagnosticDebug(
        component,
        operation,
        message,
        typeof data === 'object' && data !== null
          ? (data as Record<string, unknown>)
          : (data as string | number | undefined)
      ),
  };
}
