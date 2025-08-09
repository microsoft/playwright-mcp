/**
 * Common error enrichment utilities and patterns
 */

import { createEmptyStringArray } from '../../utils/arrayUtils.js';
import {
  type createDiagnosticLogger,
  diagnosticWarn,
} from './diagnostic-base.js';

export interface ErrorContext {
  operation: string;
  component: string;
  executionTime?: number;
  memoryUsage?: number;
  selector?: string;
  metadata?: Record<string, unknown>;
}

export interface EnrichmentResult {
  enhancedError: Error;
  suggestions: string[];
  contextInfo?: Record<string, unknown>;
}

/**
 * Common error enrichment patterns and utilities
 */
const errorPatterns = new Map<RegExp, string[]>([
  [
    /timeout/i,
    [
      'Consider increasing timeout values',
      'Check for slow network conditions',
      'Verify element loading states',
    ],
  ],
  [
    /not found|element not visible/i,
    [
      'Verify element selector accuracy',
      'Wait for element to become visible',
      'Check if element is in correct frame context',
    ],
  ],
  [
    /not enabled|disabled/i,
    [
      'Wait for element to become enabled',
      'Check element state and attributes',
      'Verify no modal dialogs are blocking interaction',
    ],
  ],
  [
    /disposed|disposed/i,
    [
      'Component or resource was disposed prematurely',
      'Check component lifecycle management',
      'Ensure proper initialization before use',
    ],
  ],
  [
    /memory/i,
    [
      'Check for memory leaks or excessive resource usage',
      'Consider more aggressive resource cleanup',
      'Monitor memory usage patterns',
    ],
  ],
]);

/**
 * Generate pattern-based suggestions for error messages
 */
function getPatternBasedSuggestions(message: string): string[] {
  const suggestions = createEmptyStringArray();
  for (const [pattern, patternSuggestions] of errorPatterns) {
    if (pattern.test(message)) {
      suggestions.push(...patternSuggestions);
    }
  }
  return suggestions;
}

/**
 * Generate context-specific suggestions
 */
function getContextSpecificSuggestions(context: ErrorContext): string[] {
  const suggestions = createEmptyStringArray();

  if (context.executionTime && context.executionTime > 5000) {
    suggestions.push('Long execution time detected - consider optimization');
  }

  if (context.selector) {
    suggestions.push(`Failed selector: ${context.selector}`);
    if (context.selector.includes('#')) {
      suggestions.push('ID selectors may be fragile - consider alternatives');
    }
    if (context.selector.includes('nth-child')) {
      suggestions.push(
        'Position-based selectors are fragile - use semantic selectors'
      );
    }
  }

  if (context.component === 'PageAnalyzer') {
    suggestions.push('Consider using parallel analysis for complex pages');
  }

  if (context.operation.includes('iframe')) {
    suggestions.push(
      'Check iframe accessibility and cross-origin restrictions'
    );
  }

  return suggestions;
}

/**
 * Generate contextual suggestions based on error message patterns
 */
export function generateSuggestions(
  error: Error,
  context?: ErrorContext
): string[] {
  const suggestions = createEmptyStringArray();
  const message = error.message.toLowerCase();

  // Pattern-based suggestions
  suggestions.push(...getPatternBasedSuggestions(message));

  // Context-specific suggestions
  if (context) {
    suggestions.push(...getContextSpecificSuggestions(context));
  }

  // Remove duplicates and limit suggestions
  const uniqueSuggestions = [...new Set(suggestions)];
  return uniqueSuggestions.slice(0, 5);
}

/**
 * Safely dispose resources with enhanced error handling
 */
export async function safeDispose<T extends { dispose(): Promise<void> }>(
  resource: T,
  resourceType: string,
  operation: string,
  logger?: ReturnType<typeof createDiagnosticLogger>
): Promise<void> {
  try {
    await resource.dispose();
  } catch (error) {
    const message = `Failed to dispose ${resourceType}`;
    if (logger) {
      logger.warn(message, error);
    } else {
      diagnosticWarn(
        'ErrorEnrichmentUtils',
        operation,
        message,
        error instanceof Error ? error : String(error)
      );
    }
  }
}

/**
 * Safely dispose multiple resources
 */
export async function safeDisposeAll<T extends { dispose(): Promise<void> }>(
  resources: T[],
  resourceType: string,
  operation: string,
  logger?: ReturnType<typeof createDiagnosticLogger>
): Promise<void> {
  const disposePromises = resources.map((resource) =>
    safeDispose(resource, resourceType, operation, logger)
  );

  await Promise.allSettled(disposePromises);
}

/**
 * Create enriched error with common patterns
 */
export function createEnrichedError(
  originalError: Error,
  context: ErrorContext,
  additionalSuggestions: string[] = []
): EnrichmentResult {
  const suggestions = [
    ...generateSuggestions(originalError, context),
    ...additionalSuggestions,
  ];

  const enhancedError = new Error(originalError.message);
  (
    enhancedError as Error & {
      originalError?: Error;
      context?: ErrorContext;
      suggestions?: string[];
    }
  ).originalError = originalError;
  (
    enhancedError as Error & {
      originalError?: Error;
      context?: ErrorContext;
      suggestions?: string[];
    }
  ).context = context;
  (
    enhancedError as Error & {
      originalError?: Error;
      context?: ErrorContext;
      suggestions?: string[];
    }
  ).suggestions = suggestions;

  return {
    enhancedError,
    suggestions,
    contextInfo: {
      component: context.component,
      operation: context.operation,
      executionTime: context.executionTime,
      timestamp: Date.now(),
    },
  };
}

/**
 * Analyze pattern frequencies from error messages
 */
function analyzePatternFrequency(
  errors: Array<{ error: Error; timestamp: number; context: ErrorContext }>
): {
  patternCounts: Map<string, number>;
  patternSuggestions: Map<string, Set<string>>;
} {
  const patternCounts = new Map<string, number>();
  const patternSuggestions = new Map<string, Set<string>>();

  for (const { error } of errors) {
    const message = error.message.toLowerCase();

    for (const [pattern, suggestions] of errorPatterns) {
      if (pattern.test(message)) {
        const patternStr = pattern.source;
        patternCounts.set(patternStr, (patternCounts.get(patternStr) ?? 0) + 1);

        if (!patternSuggestions.has(patternStr)) {
          patternSuggestions.set(patternStr, new Set());
        }
        for (const s of suggestions) {
          patternSuggestions.get(patternStr)?.add(s);
        }
      }
    }
  }

  return { patternCounts, patternSuggestions };
}

/**
 * Build frequent patterns array from counts and suggestions
 */
function buildFrequentPatterns(
  patternCounts: Map<string, number>,
  patternSuggestions: Map<string, Set<string>>
): Array<{ pattern: string; count: number; suggestions: string[] }> {
  return Array.from(patternCounts.entries())
    .filter(([, count]) => count > 1)
    .sort(([, a], [, b]) => b - a)
    .map(([pattern, count]) => ({
      pattern,
      count,
      suggestions: Array.from(patternSuggestions.get(pattern) ?? []),
    }));
}

/**
 * Analyze time-based error patterns
 */
function analyzeTimeBasedPatterns(
  errors: Array<{ error: Error; timestamp: number; context: ErrorContext }>
): { recentErrors: number; errorRate: number } {
  const now = Date.now();
  const oneHour = 60 * 60 * 1000;
  const recentErrors = errors.filter((e) => now - e.timestamp < oneHour);

  return {
    recentErrors: recentErrors.length,
    errorRate: errors.length > 0 ? recentErrors.length / errors.length : 0,
  };
}

/**
 * Analyze component-based error distribution
 */
function analyzeComponentErrors(
  errors: Array<{ error: Error; timestamp: number; context: ErrorContext }>
): Record<string, number> {
  const componentAnalysis: Record<string, number> = {};
  for (const { context } of errors) {
    componentAnalysis[context.component] =
      (componentAnalysis[context.component] ?? 0) + 1;
  }
  return componentAnalysis;
}

/**
 * Analyze error frequency and patterns
 */
export function analyzeErrorPatterns(
  errors: Array<{ error: Error; timestamp: number; context: ErrorContext }>
): {
  frequentPatterns: Array<{
    pattern: string;
    count: number;
    suggestions: string[];
  }>;
  timeBasedAnalysis: { recentErrors: number; errorRate: number };
  componentAnalysis: Record<string, number>;
} {
  const { patternCounts, patternSuggestions } = analyzePatternFrequency(errors);
  const frequentPatterns = buildFrequentPatterns(
    patternCounts,
    patternSuggestions
  );
  const timeBasedAnalysis = analyzeTimeBasedPatterns(errors);
  const componentAnalysis = analyzeComponentErrors(errors);

  return {
    frequentPatterns,
    timeBasedAnalysis,
    componentAnalysis,
  };
}

/**
 * Generate recovery suggestions based on error analysis
 */
export function generateRecoverySuggestions(
  errorAnalysis: ReturnType<typeof analyzeErrorPatterns>
): string[] {
  const suggestions = createEmptyStringArray();

  if (errorAnalysis.timeBasedAnalysis.errorRate > 0.5) {
    suggestions.push('High error rate detected - review recent changes');
  }

  if (errorAnalysis.frequentPatterns.length > 0) {
    const mostFrequent = errorAnalysis.frequentPatterns[0];
    suggestions.push(
      `Most frequent error pattern: ${mostFrequent.pattern} (${mostFrequent.count} occurrences)`
    );
    suggestions.push(...mostFrequent.suggestions.slice(0, 2));
  }

  // Component-specific suggestions
  const componentWithMostErrors = Object.entries(
    errorAnalysis.componentAnalysis
  ).sort(([, a], [, b]) => b - a)[0];

  if (componentWithMostErrors && componentWithMostErrors[1] > 3) {
    suggestions.push(
      `${componentWithMostErrors[0]} component has frequent errors - review implementation`
    );
  }

  return suggestions.slice(0, 5);
}
