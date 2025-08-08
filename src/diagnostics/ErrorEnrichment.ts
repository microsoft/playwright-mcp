/**
 * Error enrichment with diagnostic information and suggestions
 */

import { PageAnalyzer  } from './PageAnalyzer.js';
import { ElementDiscovery   } from './ElementDiscovery.js';
import type { PageStructureAnalysis } from './PageAnalyzer.js';
import type { AlternativeElement, SearchCriteria } from './ElementDiscovery.js';
import type * as playwright from 'playwright';

export interface EnrichedError extends Error {
  originalError: Error;
  alternatives?: AlternativeElement[];
  diagnosticInfo?: PageStructureAnalysis;
  suggestions?: string[];
  batchContext?: BatchFailureContext;
}

export interface BatchFailureContext {
  failedStep: {
    stepIndex: number;
    toolName: string;
    selector?: string;
  };
  executedSteps: Array<{
    stepIndex: number;
    toolName: string;
    success: boolean;
  }>;
}

export interface ElementNotFoundOptions {
  originalError: Error;
  selector: string;
  searchCriteria?: SearchCriteria;
  maxAlternatives?: number;
}

export interface TimeoutErrorOptions {
  originalError: Error;
  operation: string;
  selector?: string;
}

export interface BatchFailureOptions {
  originalError: Error;
  failedStep: BatchFailureContext['failedStep'];
  executedSteps: BatchFailureContext['executedSteps'];
}

export class ErrorEnrichment {
  private readonly pageAnalyzer: PageAnalyzer;
  private readonly elementDiscovery: ElementDiscovery;

  constructor(private readonly page: playwright.Page) {
    this.pageAnalyzer = new PageAnalyzer(page);
    this.elementDiscovery = new ElementDiscovery(page);
  }

  async enrichElementNotFoundError(options: ElementNotFoundOptions): Promise<EnrichedError> {
    const { originalError, selector, searchCriteria, maxAlternatives } = options;

    const [alternatives, diagnosticInfo] = await Promise.all([
      searchCriteria ?
        this.elementDiscovery.findAlternativeElements({
          originalSelector: selector,
          searchCriteria,
          maxResults: maxAlternatives
        }) : Promise.resolve([]),
      this.pageAnalyzer.analyzePageStructure()
    ]);

    const suggestions = this.generateElementNotFoundSuggestions(diagnosticInfo, alternatives);

    const enrichedError = new Error(this.enhanceErrorMessage(originalError, alternatives)) as EnrichedError;
    enrichedError.originalError = originalError;
    enrichedError.alternatives = alternatives;
    enrichedError.diagnosticInfo = diagnosticInfo;
    enrichedError.suggestions = suggestions;

    return enrichedError;
  }

  async enrichTimeoutError(options: TimeoutErrorOptions): Promise<EnrichedError> {
    const { originalError, operation, selector } = options;

    const diagnosticInfo = await this.pageAnalyzer.analyzePageStructure();
    const suggestions = this.generateTimeoutSuggestions(diagnosticInfo, operation, selector);

    const enrichedError = new Error(originalError.message) as EnrichedError;
    enrichedError.originalError = originalError;
    enrichedError.diagnosticInfo = diagnosticInfo;
    enrichedError.suggestions = suggestions;

    return enrichedError;
  }

  async enrichBatchFailureError(options: BatchFailureOptions): Promise<EnrichedError> {
    const { originalError, failedStep, executedSteps } = options;

    const diagnosticInfo = await this.pageAnalyzer.analyzePageStructure();
    const suggestions = this.generateBatchFailureSuggestions(diagnosticInfo, failedStep);

    const enrichedError = new Error(originalError.message) as EnrichedError;
    enrichedError.originalError = originalError;
    enrichedError.diagnosticInfo = diagnosticInfo;
    enrichedError.suggestions = suggestions;
    enrichedError.batchContext = {
      failedStep,
      executedSteps
    };

    return enrichedError;
  }

  private enhanceErrorMessage(originalError: Error, alternatives: AlternativeElement[]): string {
    let message = originalError.message;

    if (alternatives.length > 0) {
      message += '\n\nAlternative elements found:';
      alternatives.forEach((alt, index) => {
        message += `\n${index + 1}. ${alt.selector} (confidence: ${(alt.confidence * 100).toFixed(0)}%) - ${alt.reason}`;
      });
    }

    return message;
  }

  private generateElementNotFoundSuggestions(
    diagnosticInfo: PageStructureAnalysis,
    alternatives: AlternativeElement[]
  ): string[] {
    const suggestions: string[] = [];

    if (alternatives.length > 0) {
      suggestions.push(`Try using one of the ${alternatives.length} alternative elements found`);
      if (alternatives[0].confidence > 0.8)
        suggestions.push(`High confidence match available: ${alternatives[0].selector}`);

    }

    if (diagnosticInfo.iframes.detected) {
      suggestions.push('Element might be inside an iframe');
      if (diagnosticInfo.iframes.inaccessible.length > 0)
        suggestions.push('Some iframes are not accessible - check cross-origin restrictions');

    }

    if (diagnosticInfo.modalStates.blockedBy.length > 0)
      suggestions.push(`Page has active modal dialog - handle it first`);


    if (diagnosticInfo.elements.missingAria > 0)
      suggestions.push('Some elements lack proper ARIA attributes - consider using text-based selectors');


    return suggestions;
  }

  private generateTimeoutSuggestions(
    diagnosticInfo: PageStructureAnalysis,
    operation: string,
    selector?: string
  ): string[] {
    const suggestions: string[] = [];

    if (diagnosticInfo.modalStates.blockedBy.length > 0)
      suggestions.push(`Page has active modal dialog - handle it before performing ${operation}`);


    if (diagnosticInfo.iframes.detected)
      suggestions.push('Element might be inside an iframe');


    if (selector) {
      suggestions.push(`Try waiting for element visibility: ${selector}`);
      suggestions.push('Consider increasing timeout for slow-loading elements');
    }

    suggestions.push(`Wait for page load completion before performing ${operation}`);

    return suggestions;
  }

  private generateBatchFailureSuggestions(
    diagnosticInfo: PageStructureAnalysis,
    failedStep: BatchFailureContext['failedStep']
  ): string[] {
    const suggestions: string[] = [];

    suggestions.push(`Batch execution failed at step ${failedStep.stepIndex} (${failedStep.toolName})`);

    if (diagnosticInfo.modalStates.blockedBy.length > 0)
      suggestions.push('Modal dialog detected - may block subsequent operations');


    if (failedStep.selector)
      suggestions.push(`Failed selector: ${failedStep.selector} - check element availability`);


    suggestions.push('Consider adding wait steps between operations');
    suggestions.push('Verify page state changes after each navigation step');

    return suggestions;
  }
}
