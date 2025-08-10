/**
 * Structured error for diagnostic operations with enhanced context
 */

export type DiagnosticComponent =
  | 'PageAnalyzer'
  | 'ElementDiscovery'
  | 'ResourceManager'
  | 'ErrorHandler'
  | 'ConfigManager'
  | 'UnifiedSystem'
  | 'InitializationManager';

export const PERFORMANCE_IMPACT_LEVELS = ['low', 'medium', 'high'] as const;
export type PerformanceImpactLevel = (typeof PERFORMANCE_IMPACT_LEVELS)[number];

export interface DiagnosticErrorContext {
  timestamp: number;
  component: DiagnosticComponent;
  operation: string;
  executionTime?: number;
  memoryUsage?: number;
  performanceImpact?: PerformanceImpactLevel;
  suggestions?: string[];
  context?: Record<string, unknown>; // Additional context information
}

/**
 * Enhanced error class for diagnostic system operations
 * Provides structured error information with component context
 */
export class DiagnosticError extends Error {
  readonly timestamp: number;
  readonly component: DiagnosticComponent;
  readonly operation: string;
  readonly originalError?: Error;
  readonly executionTime?: number;
  readonly memoryUsage?: number;
  readonly performanceImpact?: PerformanceImpactLevel;
  readonly suggestions: string[];
  readonly context?: Record<string, unknown>;

  constructor(
    message: string,
    context: DiagnosticErrorContext,
    originalError?: Error
  ) {
    const enhancedMessage = `[${context.component}:${context.operation}] ${message}`;
    super(enhancedMessage);

    this.name = 'DiagnosticError';
    this.timestamp = context.timestamp;
    this.component = context.component;
    this.operation = context.operation;
    this.originalError = originalError;
    this.executionTime = context.executionTime;
    this.memoryUsage = context.memoryUsage;
    this.performanceImpact = context.performanceImpact ?? 'low';
    this.suggestions = context.suggestions ?? [];
    this.context = context.context;

    // Maintain stack trace for debugging
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, DiagnosticError);
    }
  }

  /**
   * Create a DiagnosticError from a standard Error
   */
  static from(
    error: Error,
    component: DiagnosticComponent,
    operation: string,
    additionalContext?: Partial<DiagnosticErrorContext>
  ): DiagnosticError {
    return new DiagnosticError(
      error.message,
      {
        timestamp: Date.now(),
        component,
        operation,
        ...additionalContext,
      },
      error
    );
  }

  /**
   * Create a performance-related DiagnosticError
   */
  static performance(
    message: string,
    component: DiagnosticComponent,
    operation: string,
    executionTime: number,
    threshold: number
  ): DiagnosticError {
    let impact: PerformanceImpactLevel;
    if (executionTime > threshold * 3) {
      impact = 'high';
    } else if (executionTime > threshold * 2) {
      impact = 'medium';
    } else {
      impact = 'low';
    }

    return new DiagnosticError(
      `Performance issue: ${message} (${executionTime}ms > ${threshold}ms)`,
      {
        timestamp: Date.now(),
        component,
        operation,
        executionTime,
        performanceImpact: impact,
        suggestions: [
          `Operation took longer than expected (${executionTime}ms vs ${threshold}ms threshold)`,
          'Consider optimizing this operation or increasing timeout thresholds',
        ],
      }
    );
  }

  /**
   * Create a resource-related DiagnosticError
   */
  static resource(
    message: string,
    component: DiagnosticComponent,
    operation: string,
    memoryUsage: number,
    memoryLimit: number
  ): DiagnosticError {
    let impact: PerformanceImpactLevel;
    if (memoryUsage > memoryLimit * 2) {
      impact = 'high';
    } else if (memoryUsage > memoryLimit * 1.5) {
      impact = 'medium';
    } else {
      impact = 'low';
    }

    return new DiagnosticError(
      `Resource issue: ${message} (${(memoryUsage / 1024 / 1024).toFixed(2)}MB)`,
      {
        timestamp: Date.now(),
        component,
        operation,
        memoryUsage,
        performanceImpact: impact,
        suggestions: [
          `Memory usage exceeded expectations (${(memoryUsage / 1024 / 1024).toFixed(2)}MB vs ${(memoryLimit / 1024 / 1024).toFixed(2)}MB limit)`,
          'Consider enabling resource cleanup or reducing analysis scope',
        ],
      }
    );
  }

  /**
   * Convert error to structured JSON for logging
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      timestamp: this.timestamp,
      component: this.component,
      operation: this.operation,
      executionTime: this.executionTime,
      memoryUsage: this.memoryUsage,
      performanceImpact: this.performanceImpact,
      suggestions: this.suggestions,
      stack: this.stack,
      originalError: this.originalError
        ? {
            name: this.originalError.name,
            message: this.originalError.message,
            stack: this.originalError.stack,
          }
        : undefined,
    };
  }

  /**
   * Format error for human-readable display
   */
  toString(): string {
    const parts = [this.message];

    if (this.executionTime !== undefined) {
      parts.push(`Execution Time: ${this.executionTime}ms`);
    }

    if (this.memoryUsage !== undefined) {
      parts.push(
        `Memory Usage: ${(this.memoryUsage / 1024 / 1024).toFixed(2)}MB`
      );
    }

    if (this.suggestions.length > 0) {
      parts.push('Suggestions:');
      for (const suggestion of this.suggestions) {
        parts.push(`  - ${suggestion}`);
      }
    }

    return parts.join('\n');
  }
}
