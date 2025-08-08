// @ts-nocheck
/**
 * Enhanced error handler that integrates diagnostic information with unified system support
 */

import type * as playwright from 'playwright';
import { createDiagnosticLogger, DiagnosticBase } from './common/index.js';
import type { DiagnosticComponent } from './diagnostic-error.js';
import { DiagnosticError } from './diagnostic-error.js';
import type { DiagnosticConfig } from './diagnostic-level.js';
import { DiagnosticLevelManager } from './diagnostic-level.js';
import type { SearchCriteria } from './element-discovery.js';
import { ElementDiscovery } from './element-discovery.js';
import type { EnrichedError } from './error-enrichment.js';
import { ErrorEnrichment } from './error-enrichment.js';
import type { PageStructureAnalysis } from './page-analyzer.js';
import { PageAnalyzer } from './page-analyzer.js';

export interface PlaywrightErrorOptions {
  error: Error;
  operation: string;
  selector?: string;
  context?: {
    searchCriteria?: SearchCriteria;
    expectedText?: string;
    timeout?: number;
  };
}

export interface TimeoutErrorOptions {
  error: Error;
  operation: string;
  selector?: string;
  timeout?: number;
}

export interface ContextErrorOptions {
  error: Error;
  selector: string;
  expectedContext: string;
}

export interface PerformanceErrorOptions {
  operation: string;
  selector?: string;
  executionTime: number;
  performanceThreshold: number;
}

export interface ToolErrorOptions {
  toolName: string;
  error: Error;
  selector?: string;
  toolArgs?: Record<string, unknown>;
}

export interface EnhancedPlaywrightError extends EnrichedError {
  contextInfo?: {
    availableFrames: number;
    currentFrame: string;
  };
  performanceInfo?: {
    executionTime: number;
    exceededThreshold: boolean;
    threshold: number;
  };
  toolContext?: {
    toolName: string;
    toolArgs: Record<string, unknown>;
  };
}

export class EnhancedErrorHandler extends DiagnosticBase {
  private readonly pageAnalyzer: PageAnalyzer;
  private readonly elementDiscovery: ElementDiscovery;
  private readonly errorEnrichment: ErrorEnrichment;
  private readonly diagnosticManager: DiagnosticLevelManager;
  private readonly logger: ReturnType<typeof createDiagnosticLogger>;
  private errorHistory: Array<{
    error: DiagnosticError;
    timestamp: number;
    component: DiagnosticComponent;
    resolved: boolean;
  }> = [];
  private readonly maxErrorHistory: number;

  constructor(
    page: playwright.Page,
    diagnosticConfig?: Partial<DiagnosticConfig>
  ) {
    super(page, 'EnhancedErrorHandler');
    this.pageAnalyzer = new PageAnalyzer(page);
    this.elementDiscovery = new ElementDiscovery(page);
    this.errorEnrichment = new ErrorEnrichment(page);
    this.diagnosticManager = new DiagnosticLevelManager(diagnosticConfig);
    this.logger = createDiagnosticLogger(
      'EnhancedErrorHandler',
      'error-handling'
    );
    this.maxErrorHistory = diagnosticConfig?.maxErrorHistory || 100;
  }

  protected async performDispose(): Promise<void> {
    await this.pageAnalyzer.dispose();
    await this.elementDiscovery.dispose();
    await this.errorEnrichment.dispose();
  }

  async enhancePlaywrightError(
    options: PlaywrightErrorOptions
  ): Promise<EnhancedPlaywrightError> {
    const { error, operation, selector, context } = options;

    // Check if diagnostics should be skipped entirely
    if (this.diagnosticManager.shouldSkipDiagnostics()) {
      return error as EnhancedPlaywrightError;
    }

    if (
      selector &&
      context?.searchCriteria &&
      this.diagnosticManager.shouldEnableFeature('alternativeSuggestions')
    ) {
      // Use element not found enrichment for selectors with search criteria
      const enrichedError =
        await this.errorEnrichment.enrichElementNotFoundError({
          originalError: error,
          selector,
          searchCriteria: context.searchCriteria,
          maxAlternatives: this.diagnosticManager.getMaxAlternatives(),
        });

      return enrichedError as EnhancedPlaywrightError;
    }

    if (error.message.includes('Timeout')) {
      return this.enhanceTimeoutError({
        error,
        operation,
        selector,
        timeout: context?.timeout || 30_000,
      });
    }

    // General error enhancement with diagnostic information
    let pageStructure: PageStructureAnalysis | undefined;
    if (this.diagnosticManager.shouldEnableFeature('pageAnalysis')) {
      pageStructure = await this.pageAnalyzer.analyzePageStructure();
    }

    const suggestions = pageStructure
      ? this.generateGeneralSuggestions(error, operation, pageStructure)
      : [];

    const enhancedError = new Error(error.message) as EnhancedPlaywrightError;
    enhancedError.originalError = error;
    if (pageStructure) {
      enhancedError.pageStructure = pageStructure;
    }

    enhancedError.suggestions = suggestions;

    return enhancedError;
  }

  async enhanceTimeoutError(
    options: TimeoutErrorOptions
  ): Promise<EnhancedPlaywrightError> {
    const { error, operation, selector } = options;

    const enrichedError = await this.errorEnrichment.enrichTimeoutError({
      originalError: error,
      operation,
      selector,
    });

    // Add timeout-specific information
    const contextInfo = await this.analyzeFrameContext();

    (enrichedError as EnhancedPlaywrightError).contextInfo = contextInfo;

    return enrichedError as EnhancedPlaywrightError;
  }

  async enhanceContextError(
    options: ContextErrorOptions
  ): Promise<EnhancedPlaywrightError> {
    const { error, expectedContext } = options;

    const contextInfo = await this.analyzeFrameContext();
    const pageStructure = await this.pageAnalyzer.analyzePageStructure();

    const suggestions = [
      `Expected element in ${expectedContext} context`,
      `Found ${contextInfo.availableFrames} available frames`,
      'Try switching to the correct frame context',
    ];

    if (pageStructure.iframes.detected) {
      suggestions.push(
        'element might be in a different frame - use frameLocator()'
      );
    }

    const enhancedError = new Error(error.message) as EnhancedPlaywrightError;
    enhancedError.originalError = error;
    enhancedError.contextInfo = contextInfo;
    enhancedError.pageStructure = pageStructure;
    enhancedError.suggestions = suggestions;

    return enhancedError;
  }

  async enhancePerformanceError(
    options: PerformanceErrorOptions
  ): Promise<EnhancedPlaywrightError> {
    const { operation, executionTime, performanceThreshold } = options;

    const pageStructure = await this.pageAnalyzer.analyzePageStructure();
    const exceededThreshold = executionTime > performanceThreshold;

    const performanceInfo = {
      executionTime,
      exceededThreshold,
      threshold: performanceThreshold,
    };

    const suggestions = [
      `Operation took longer than expected (${executionTime}ms vs ${performanceThreshold}ms threshold)`,
      'Consider optimizing page load performance',
      'Check for heavy JavaScript execution or network delays',
    ];

    if (pageStructure.modalStates.blockedBy.length > 0) {
      suggestions.push('Modal dialogs may be causing delays');
    }

    const error = new Error(
      `Performance issue: ${operation} operation exceeded threshold`
    ) as EnhancedPlaywrightError;
    error.performanceInfo = performanceInfo;
    error.pageStructure = pageStructure;
    error.suggestions = suggestions;

    return error;
  }

  async enhanceToolError(
    options: ToolErrorOptions
  ): Promise<EnhancedPlaywrightError> {
    const { toolName, error, toolArgs } = options;

    const pageStructure = await this.pageAnalyzer.analyzePageStructure();

    const toolContext = {
      toolName,
      toolArgs: toolArgs || {},
    };

    const suggestions = this.generateToolSpecificSuggestions(
      toolName,
      error,
      pageStructure
    );

    const enhancedError = new Error(error.message) as EnhancedPlaywrightError;
    enhancedError.originalError = error;
    enhancedError.toolContext = toolContext;
    enhancedError.pageStructure = pageStructure;
    enhancedError.suggestions = suggestions;

    return enhancedError;
  }

  private async analyzeFrameContext() {
    const page = this.getPage();
    const frames = await page.frames();
    const mainFrame = page.mainFrame();

    return {
      availableFrames: frames.length,
      currentFrame: mainFrame.name() || 'main',
    };
  }

  private generateGeneralSuggestions(
    error: Error,
    operation: string,
    pageStructure: PageStructureAnalysis
  ): string[] {
    const suggestions: string[] = [];

    if (pageStructure.modalStates.blockedBy.length > 0) {
      suggestions.push(
        `Page has active modal - handle before performing ${operation}`
      );
    }

    if (pageStructure.iframes.detected) {
      suggestions.push('Check if target element is inside an iframe');
    }

    if (error.message.includes('not found')) {
      suggestions.push(
        'Element selector might be incorrect or element not yet loaded'
      );
      suggestions.push(
        'Try waiting for element to be visible before interacting'
      );
    }

    return suggestions;
  }

  private generateToolSpecificSuggestions(
    toolName: string,
    error: Error,
    pageStructure: PageStructureAnalysis
  ): string[] {
    const suggestions: string[] = [];

    switch (toolName) {
      case 'browser_click':
        if (error.message.includes('not enabled')) {
          suggestions.push('Element appears to be disabled');
          suggestions.push(
            'Wait for element to become enabled or check if it should be enabled'
          );
        }
        if (error.message.includes('not visible')) {
          suggestions.push(
            'Element is not visible - check CSS display/visibility properties'
          );
        }

        break;

      case 'browser_type':
        if (error.message.includes('not editable')) {
          suggestions.push(
            'Element is not editable - ensure it is an input field'
          );
          suggestions.push('Check if element has readonly attribute');
        }
        break;

      case 'browser_select_option':
        suggestions.push(
          'Verify that the select element contains the specified option'
        );
        suggestions.push('Check option values and text content');
        break;

      default:
        suggestions.push(`Consider tool-specific requirements for ${toolName}`);
    }

    if (pageStructure.modalStates.blockedBy.length > 0) {
      suggestions.push(`Modal state blocking ${toolName} operation`);
    }

    return suggestions;
  }

  // Unified system integration methods

  /**
   * Create a structured DiagnosticError from any error
   */
  createDiagnosticError(
    error: Error,
    component: DiagnosticComponent,
    operation: string,
    executionTime?: number,
    memoryUsage?: number
  ): DiagnosticError {
    const diagnosticError = DiagnosticError.from(error, component, operation, {
      executionTime,
      memoryUsage,
      performanceImpact: executionTime && executionTime > 1000 ? 'high' : 'low',
    });

    // Add to error history
    this.addToErrorHistory(diagnosticError, component);

    return diagnosticError;
  }

  /**
   * Enhanced error processing with unified system context
   */
  async processUnifiedError(
    error: Error | DiagnosticError,
    component: DiagnosticComponent,
    operation: string,
    context?: {
      executionTime?: number;
      memoryUsage?: number;
      performanceThreshold?: number;
      selector?: string;
      toolArgs?: Record<string, unknown>;
    }
  ): Promise<DiagnosticError> {
    const startTime = Date.now();

    try {
      let diagnosticError: DiagnosticError;

      if (error instanceof DiagnosticError) {
        diagnosticError = error;
      } else {
        diagnosticError = this.createDiagnosticError(
          error,
          component,
          operation,
          context?.executionTime,
          context?.memoryUsage
        );
      }

      // Apply performance-based error analysis
      if (
        context?.performanceThreshold &&
        context?.executionTime &&
        context.executionTime > context.performanceThreshold
      ) {
        const perfError = DiagnosticError.performance(
          `Operation ${operation} exceeded performance threshold`,
          component,
          operation,
          context.executionTime,
          context.performanceThreshold
        );

        // Merge suggestions from performance analysis
        diagnosticError.suggestions.push(...perfError.suggestions);
      }

      // Apply contextual error enrichment if diagnostic level allows
      if (
        this.diagnosticManager.shouldEnableFeature('alternativeSuggestions')
      ) {
        const contextualSuggestions = await this.generateContextualSuggestions(
          diagnosticError,
          component,
          operation,
          context
        );
        diagnosticError.suggestions.push(...contextualSuggestions);
      }

      // Pattern-based error analysis from history
      const similarErrors = this.findSimilarErrors(diagnosticError, component);
      if (similarErrors.length > 0) {
        const patternSuggestions =
          this.generatePatternBasedSuggestions(similarErrors);
        diagnosticError.suggestions.push(...patternSuggestions);
      }

      return diagnosticError;
    } catch (processingError) {
      // Fallback: create simple diagnostic error if processing fails
      this.logger.warn(
        `Processing failed for ${component}:${operation}:`,
        processingError
      );
      return DiagnosticError.from(error as Error, component, operation, {
        executionTime: Date.now() - startTime,
      });
    }
  }

  private async generateContextualSuggestions(
    _error: DiagnosticError,
    component: DiagnosticComponent,
    operation: string,
    context?: Record<string, unknown>
  ): Promise<string[]> {
    const suggestions: string[] = [];

    try {
      // Get page diagnostic information for context
      const pageStructure = await this.pageAnalyzer.analyzePageStructure();

      // Component-specific contextual suggestions
      switch (component) {
        case 'PageAnalyzer':
          if (pageStructure.elements.totalVisible > 10_000) {
            suggestions.push(
              'Page has many elements - consider using parallel analysis'
            );
          }

          if (pageStructure.iframes.detected) {
            suggestions.push(
              'Multiple iframes detected - they may affect analysis performance'
            );
          }

          break;

        case 'ElementDiscovery':
          if (context?.selector && pageStructure.elements.missingAria > 0) {
            suggestions.push(
              'Many elements lack ARIA attributes - try text-based selectors'
            );
          }

          if (pageStructure.modalStates.blockedBy.length > 0) {
            suggestions.push('Modal dialogs may be hiding target elements');
          }

          break;

        case 'ResourceManager':
          if (
            context?.memoryUsage &&
            (context.memoryUsage as any) > 50 * 1024 * 1024
          ) {
            suggestions.push(
              'High memory usage detected - consider more aggressive cleanup'
            );
          }

          break;
      }

      // Operation-specific suggestions
      if (
        operation.includes('parallel') &&
        pageStructure.elements.totalVisible < 1000
      ) {
        suggestions.push(
          'Parallel analysis may not be beneficial for simple pages'
        );
      }

      if (operation.includes('timeout')) {
        suggestions.push(
          'Consider adjusting timeout thresholds based on page complexity'
        );
      }
    } catch (contextError) {
      // Failed to generate contextual suggestions - continue with available suggestions
      this.logger.warn(
        `Context generation failed for ${component}:${operation}:`,
        contextError
      );
    }

    return suggestions;
  }

  private addToErrorHistory(
    error: DiagnosticError,
    component: DiagnosticComponent
  ): void {
    this.errorHistory.push({
      error,
      timestamp: Date.now(),
      component,
      resolved: false,
    });

    // Maintain history size limit
    if (this.errorHistory.length > this.maxErrorHistory) {
      this.errorHistory = this.errorHistory.slice(-this.maxErrorHistory);
    }
  }

  private findSimilarErrors(
    error: DiagnosticError,
    component: DiagnosticComponent
  ): DiagnosticError[] {
    const timeWindow = 300_000; // 5 minutes
    const now = Date.now();

    return this.errorHistory
      .filter(
        (entry) =>
          entry.component === component &&
          entry.error.operation === error.operation &&
          now - entry.timestamp < timeWindow
      )
      .map((entry) => entry.error)
      .slice(-5); // Last 5 similar errors
  }

  private generatePatternBasedSuggestions(
    similarErrors: DiagnosticError[]
  ): string[] {
    const suggestions: string[] = [];

    if (similarErrors.length >= 3) {
      suggestions.push(
        `This error has occurred ${similarErrors.length} times recently - consider reviewing the operation`
      );

      // Analyze common patterns in similar errors
      const commonSuggestions = this.findCommonSuggestions(similarErrors);
      if (commonSuggestions.length > 0) {
        suggestions.push('Common resolution patterns:');
        suggestions.push(...commonSuggestions.slice(0, 3));
      }
    }

    return suggestions;
  }

  private findCommonSuggestions(errors: DiagnosticError[]): string[] {
    const suggestionCounts = new Map<string, number>();

    for (const error of errors) {
      for (const suggestion of error.suggestions) {
        const count = suggestionCounts.get(suggestion) || 0;
        suggestionCounts.set(suggestion, count + 1);
      }
    }

    // Return suggestions that appear in multiple errors
    return Array.from(suggestionCounts.entries())
      .filter(([, count]) => count > 1)
      .sort(([, a], [, b]) => b - a)
      .map(([suggestion]) => suggestion);
  }

  /**
   * Mark error as resolved for pattern analysis
   */
  markErrorResolved(errorId: string): void {
    const entry = this.errorHistory.find(
      (e) =>
        e.error.timestamp.toString() === errorId ||
        e.error.message.includes(errorId)
    );
    if (entry) {
      entry.resolved = true;
    }
  }

  /**
   * Get error statistics for monitoring
   */
  getErrorStatistics(): {
    totalErrors: number;
    errorsByComponent: Record<DiagnosticComponent, number>;
    errorsByOperation: Record<string, number>;
    resolutionRate: number;
    recentErrorRate: number;
  } {
    const now = Date.now();
    const recentTimeWindow = 600_000; // 10 minutes

    const recentErrors = this.errorHistory.filter(
      (e) => now - e.timestamp < recentTimeWindow
    );
    const resolvedErrors = this.errorHistory.filter((e) => e.resolved);

    const errorsByComponent: Record<DiagnosticComponent, number> = {
      PageAnalyzer: 0,
      ElementDiscovery: 0,
      ResourceManager: 0,
      ErrorHandler: 0,
      ConfigManager: 0,
      UnifiedSystem: 0,
    };

    const errorsByOperation: Record<string, number> = {};

    for (const entry of this.errorHistory) {
      errorsByComponent[entry.component]++;

      const operation = entry.error.operation;
      errorsByOperation[operation] = (errorsByOperation[operation] || 0) + 1;
    }

    return {
      totalErrors: this.errorHistory.length,
      errorsByComponent,
      errorsByOperation,
      resolutionRate:
        this.errorHistory.length > 0
          ? resolvedErrors.length / this.errorHistory.length
          : 1,
      recentErrorRate:
        recentErrors.length / Math.max(this.errorHistory.length, 1),
    };
  }

  /**
   * Clear error history
   */
  clearErrorHistory(): void {
    this.errorHistory = [];
  }

  /**
   * Get recent errors for debugging
   */
  getRecentErrors(limit = 10): Array<{
    error: DiagnosticError;
    timestamp: number;
    component: DiagnosticComponent;
    resolved: boolean;
  }> {
    return this.errorHistory.slice(-limit);
  }
}
