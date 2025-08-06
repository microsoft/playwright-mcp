/**
 * Enhanced error handler that integrates diagnostic information
 */

import type * as playwright from 'playwright';
import { PageAnalyzer, type PageStructureAnalysis } from './PageAnalyzer.js';
import { ElementDiscovery, type AlternativeElement, type SearchCriteria } from './ElementDiscovery.js';
import { ErrorEnrichment, type EnrichedError } from './ErrorEnrichment.js';
import { DiagnosticLevelManager, DiagnosticLevel, type DiagnosticConfig } from './DiagnosticLevel.js';

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

  constructor(private page: playwright.Page, diagnosticConfig?: Partial<DiagnosticConfig>) {
    this.pageAnalyzer = new PageAnalyzer(page);
    this.elementDiscovery = new ElementDiscovery(page);
    this.errorEnrichment = new ErrorEnrichment(page);
    this.diagnosticManager = new DiagnosticLevelManager(diagnosticConfig);
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
}