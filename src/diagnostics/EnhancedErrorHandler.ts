/**
 * Enhanced error handler that integrates diagnostic information with unified system support
 */

import type * as playwright from 'playwright';
import { PageAnalyzer, type PageStructureAnalysis } from './PageAnalyzer.js';
import { ElementDiscovery, type AlternativeElement, type SearchCriteria } from './ElementDiscovery.js';
import { ErrorEnrichment, type EnrichedError } from './ErrorEnrichment.js';
import { DiagnosticLevelManager, DiagnosticLevel, type DiagnosticConfig } from './DiagnosticLevel.js';
import { DiagnosticError, type DiagnosticComponent } from './DiagnosticError.js';

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
  toolArgs?: Record<string, any>;
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
    toolArgs: Record<string, any>;
  };
}

export class EnhancedErrorHandler {
  private pageAnalyzer: PageAnalyzer;
  private elementDiscovery: ElementDiscovery;
  private errorEnrichment: ErrorEnrichment;
  private diagnosticManager: DiagnosticLevelManager;
  private errorHistory: Array<{
    error: DiagnosticError;
    timestamp: number;
    component: DiagnosticComponent;
    resolved: boolean;
  }> = [];
  private maxErrorHistory: number = 100;

  constructor(private page: playwright.Page, diagnosticConfig?: Partial<DiagnosticConfig>) {
    this.pageAnalyzer = new PageAnalyzer(page);
    this.elementDiscovery = new ElementDiscovery(page);
    this.errorEnrichment = new ErrorEnrichment(page);
    this.diagnosticManager = new DiagnosticLevelManager(diagnosticConfig);
    this.maxErrorHistory = diagnosticConfig?.maxErrorHistory || 100;
  }

  async enhancePlaywrightError(options: PlaywrightErrorOptions): Promise<EnhancedPlaywrightError> {
    const { error, operation, selector, context } = options;

    // Check if diagnostics should be skipped entirely
    if (this.diagnosticManager.shouldSkipDiagnostics()) {
      return error as EnhancedPlaywrightError;
    }

    if (selector && context?.searchCriteria && 
        this.diagnosticManager.shouldEnableFeature('alternativeSuggestions')) {
      // Use element not found enrichment for selectors with search criteria
      const enrichedError = await this.errorEnrichment.enrichElementNotFoundError({
        originalError: error,
        selector,
        searchCriteria: context.searchCriteria,
        maxAlternatives: this.diagnosticManager.getMaxAlternatives()
      });

      return enrichedError as EnhancedPlaywrightError;
    }

    if (error.message.includes('Timeout')) {
      return this.enhanceTimeoutError({
        error,
        operation,
        selector,
        timeout: context?.timeout || 30000
      });
    }

    // General error enhancement with diagnostic information
    let diagnosticInfo: PageStructureAnalysis | undefined;
    if (this.diagnosticManager.shouldEnableFeature('pageAnalysis')) {
      diagnosticInfo = await this.pageAnalyzer.analyzePageStructure();
    }
    const suggestions = diagnosticInfo ? this.generateGeneralSuggestions(error, operation, diagnosticInfo) : [];

    const enhancedError = new Error(error.message) as EnhancedPlaywrightError;
    enhancedError.originalError = error;
    if (diagnosticInfo) {
      enhancedError.diagnosticInfo = diagnosticInfo;
    }
    enhancedError.suggestions = suggestions;

    return enhancedError;
  }

  async enhanceTimeoutError(options: TimeoutErrorOptions): Promise<EnhancedPlaywrightError> {
    const { error, operation, selector, timeout } = options;

    const enrichedError = await this.errorEnrichment.enrichTimeoutError({
      originalError: error,
      operation,
      selector
    });

    // Add timeout-specific information
    const contextInfo = await this.analyzeFrameContext();

    (enrichedError as EnhancedPlaywrightError).contextInfo = contextInfo;

    return enrichedError as EnhancedPlaywrightError;
  }

  async enhanceContextError(options: ContextErrorOptions): Promise<EnhancedPlaywrightError> {
    const { error, selector, expectedContext } = options;

    const contextInfo = await this.analyzeFrameContext();
    const diagnosticInfo = await this.pageAnalyzer.analyzePageStructure();

    const suggestions = [
      `Expected element in ${expectedContext} context`,
      `Found ${contextInfo.availableFrames} available frames`,
      'Try switching to the correct frame context'
    ];

    if (diagnosticInfo.iframes.detected) {
      suggestions.push('element might be in a different frame - use frameLocator()');
    }

    const enhancedError = new Error(error.message) as EnhancedPlaywrightError;
    enhancedError.originalError = error;
    enhancedError.contextInfo = contextInfo;
    enhancedError.diagnosticInfo = diagnosticInfo;
    enhancedError.suggestions = suggestions;

    return enhancedError;
  }

  async enhancePerformanceError(options: PerformanceErrorOptions): Promise<EnhancedPlaywrightError> {
    const { operation, selector, executionTime, performanceThreshold } = options;

    const diagnosticInfo = await this.pageAnalyzer.analyzePageStructure();
    const exceededThreshold = executionTime > performanceThreshold;

    const performanceInfo = {
      executionTime,
      exceededThreshold,
      threshold: performanceThreshold
    };

    const suggestions = [
      `Operation took longer than expected (${executionTime}ms vs ${performanceThreshold}ms threshold)`,
      'Consider optimizing page load performance',
      'Check for heavy JavaScript execution or network delays'
    ];

    if (diagnosticInfo.modalStates.blockedBy.length > 0) {
      suggestions.push('Modal dialogs may be causing delays');
    }

    const error = new Error(`Performance issue: ${operation} operation exceeded threshold`) as EnhancedPlaywrightError;
    error.performanceInfo = performanceInfo;
    error.diagnosticInfo = diagnosticInfo;
    error.suggestions = suggestions;

    return error;
  }

  async enhanceToolError(options: ToolErrorOptions): Promise<EnhancedPlaywrightError> {
    const { toolName, error, selector, toolArgs } = options;

    const diagnosticInfo = await this.pageAnalyzer.analyzePageStructure();

    const toolContext = {
      toolName,
      toolArgs: toolArgs || {}
    };

    const suggestions = this.generateToolSpecificSuggestions(toolName, error, diagnosticInfo);

    const enhancedError = new Error(error.message) as EnhancedPlaywrightError;
    enhancedError.originalError = error;
    enhancedError.toolContext = toolContext;
    enhancedError.diagnosticInfo = diagnosticInfo;
    enhancedError.suggestions = suggestions;

    return enhancedError;
  }

  private async analyzeFrameContext() {
    const frames = await this.page.frames();
    const mainFrame = this.page.mainFrame();
    
    return {
      availableFrames: frames.length,
      currentFrame: mainFrame.name() || 'main'
    };
  }

  private generateGeneralSuggestions(
    error: Error, 
    operation: string, 
    diagnosticInfo: PageStructureAnalysis
  ): string[] {
    const suggestions: string[] = [];

    if (diagnosticInfo.modalStates.blockedBy.length > 0) {
      suggestions.push(`Page has active modal - handle before performing ${operation}`);
    }

    if (diagnosticInfo.iframes.detected) {
      suggestions.push('Check if target element is inside an iframe');
    }

    if (error.message.includes('not found')) {
      suggestions.push('Element selector might be incorrect or element not yet loaded');
      suggestions.push('Try waiting for element to be visible before interacting');
    }

    return suggestions;
  }

  private generateToolSpecificSuggestions(
    toolName: string,
    error: Error,
    diagnosticInfo: PageStructureAnalysis
  ): string[] {
    const suggestions: string[] = [];

    switch (toolName) {
      case 'browser_click':
        if (error.message.includes('not enabled')) {
          suggestions.push('Element appears to be disabled');
          suggestions.push('Wait for element to become enabled or check if it should be enabled');
        }
        if (error.message.includes('not visible')) {
          suggestions.push('Element is not visible - check CSS display/visibility properties');
        }
        break;

      case 'browser_type':
        if (error.message.includes('not editable')) {
          suggestions.push('Element is not editable - ensure it is an input field');
          suggestions.push('Check if element has readonly attribute');
        }
        break;

      case 'browser_select_option':
        suggestions.push('Verify that the select element contains the specified option');
        suggestions.push('Check option values and text content');
        break;

      default:
        suggestions.push(`Consider tool-specific requirements for ${toolName}`);
    }

    if (diagnosticInfo.modalStates.blockedBy.length > 0) {
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
      performanceImpact: executionTime && executionTime > 1000 ? 'high' : 'low'
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
      toolArgs?: Record<string, any>;
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
      if (context?.performanceThreshold && context?.executionTime) {
        if (context.executionTime > context.performanceThreshold) {
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
      }

      // Apply contextual error enrichment if diagnostic level allows
      if (this.diagnosticManager.shouldEnableFeature('alternativeSuggestions')) {
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
        const patternSuggestions = this.generatePatternBasedSuggestions(similarErrors);
        diagnosticError.suggestions.push(...patternSuggestions);
      }

      return diagnosticError;

    } catch (processingError) {
      // Fallback: create simple diagnostic error if processing fails
      console.warn('[EnhancedErrorHandler] Error processing failed:', processingError);
      return DiagnosticError.from(error as Error, component, operation, {
        executionTime: Date.now() - startTime
      });
    }
  }

  private async generateContextualSuggestions(
    error: DiagnosticError,
    component: DiagnosticComponent,
    operation: string,
    context?: any
  ): Promise<string[]> {
    const suggestions: string[] = [];

    try {
      // Get page diagnostic information for context
      const diagnosticInfo = await this.pageAnalyzer.analyzePageStructure();

      // Component-specific contextual suggestions
      switch (component) {
        case 'PageAnalyzer':
          if (diagnosticInfo.elements.totalVisible > 10000) {
            suggestions.push('Page has many elements - consider using parallel analysis');
          }
          if (diagnosticInfo.iframes.detected) {
            suggestions.push('Multiple iframes detected - they may affect analysis performance');
          }
          break;

        case 'ElementDiscovery':
          if (context?.selector && diagnosticInfo.elements.missingAria > 0) {
            suggestions.push('Many elements lack ARIA attributes - try text-based selectors');
          }
          if (diagnosticInfo.modalStates.blockedBy.length > 0) {
            suggestions.push('Modal dialogs may be hiding target elements');
          }
          break;

        case 'ResourceManager':
          if (context?.memoryUsage && context.memoryUsage > 50 * 1024 * 1024) {
            suggestions.push('High memory usage detected - consider more aggressive cleanup');
          }
          break;
      }

      // Operation-specific suggestions
      if (operation.includes('parallel') && diagnosticInfo.elements.totalVisible < 1000) {
        suggestions.push('Parallel analysis may not be beneficial for simple pages');
      }

      if (operation.includes('timeout')) {
        suggestions.push('Consider adjusting timeout thresholds based on page complexity');
      }

    } catch (contextError) {
      console.warn('[EnhancedErrorHandler] Failed to generate contextual suggestions:', contextError);
    }

    return suggestions;
  }

  private addToErrorHistory(error: DiagnosticError, component: DiagnosticComponent): void {
    this.errorHistory.push({
      error,
      timestamp: Date.now(),
      component,
      resolved: false
    });

    // Maintain history size limit
    if (this.errorHistory.length > this.maxErrorHistory) {
      this.errorHistory = this.errorHistory.slice(-this.maxErrorHistory);
    }
  }

  private findSimilarErrors(error: DiagnosticError, component: DiagnosticComponent): DiagnosticError[] {
    const timeWindow = 300000; // 5 minutes
    const now = Date.now();

    return this.errorHistory
      .filter(entry => 
        entry.component === component &&
        entry.error.operation === error.operation &&
        now - entry.timestamp < timeWindow
      )
      .map(entry => entry.error)
      .slice(-5); // Last 5 similar errors
  }

  private generatePatternBasedSuggestions(similarErrors: DiagnosticError[]): string[] {
    const suggestions: string[] = [];

    if (similarErrors.length >= 3) {
      suggestions.push(`This error has occurred ${similarErrors.length} times recently - consider reviewing the operation`);
      
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
    
    errors.forEach(error => {
      error.suggestions.forEach(suggestion => {
        const count = suggestionCounts.get(suggestion) || 0;
        suggestionCounts.set(suggestion, count + 1);
      });
    });

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
    const entry = this.errorHistory.find(e => 
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
    const recentTimeWindow = 600000; // 10 minutes
    
    const recentErrors = this.errorHistory.filter(e => now - e.timestamp < recentTimeWindow);
    const resolvedErrors = this.errorHistory.filter(e => e.resolved);
    
    const errorsByComponent: Record<DiagnosticComponent, number> = {
      PageAnalyzer: 0,
      ElementDiscovery: 0,
      ResourceManager: 0,
      ErrorHandler: 0,
      ConfigManager: 0,
      UnifiedSystem: 0
    };
    
    const errorsByOperation: Record<string, number> = {};
    
    this.errorHistory.forEach(entry => {
      errorsByComponent[entry.component]++;
      
      const operation = entry.error.operation;
      errorsByOperation[operation] = (errorsByOperation[operation] || 0) + 1;
    });
    
    return {
      totalErrors: this.errorHistory.length,
      errorsByComponent,
      errorsByOperation,
      resolutionRate: this.errorHistory.length > 0 ? resolvedErrors.length / this.errorHistory.length : 1,
      recentErrorRate: recentErrors.length / Math.max(this.errorHistory.length, 1)
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
  getRecentErrors(limit: number = 10): Array<{
    error: DiagnosticError;
    timestamp: number;
    component: DiagnosticComponent;
    resolved: boolean;
  }> {
    return this.errorHistory.slice(-limit);
  }
}