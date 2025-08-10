/**
 * Error enrichment with diagnostic information and suggestions
 */

import type * as playwright from 'playwright';
import { deduplicate } from '../utils/array-utils.js';
import { createDisposableManager } from '../utils/disposable-manager.js';
import { DiagnosticBase } from './common/diagnostic-base.js';
import { generateSuggestions } from './common/error-enrichment-utils.js';
import type {
  AlternativeElement,
  SearchCriteria,
} from './element-discovery.js';
import { ElementDiscovery } from './element-discovery.js';
import type { PageStructureAnalysis } from './page-analyzer.js';
import { PageAnalyzer } from './page-analyzer.js';

export interface EnrichedError extends Error {
  originalError: Error;
  alternatives?: AlternativeElement[];
  pageStructure?: PageStructureAnalysis;
  diagnosticInfo?: PageStructureAnalysis; // Alias for pageStructure for test compatibility
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

export class ErrorEnrichment extends DiagnosticBase {
  private readonly pageAnalyzer: PageAnalyzer;
  private readonly elementDiscovery: ElementDiscovery;
  private readonly disposableManager =
    createDisposableManager('ErrorEnrichment');

  constructor(page: playwright.Page) {
    super(page, 'ErrorEnrichment');
    this.pageAnalyzer = this.disposableManager.register(new PageAnalyzer(page));
    this.elementDiscovery = this.disposableManager.register(
      new ElementDiscovery(page)
    );
  }

  protected async performDispose(): Promise<void> {
    await this.disposableManager.dispose();
  }

  async enrichElementNotFoundError(
    options: ElementNotFoundOptions
  ): Promise<EnrichedError> {
    const { originalError, selector, searchCriteria, maxAlternatives } =
      options;

    const [alternatives, pageStructure] = await Promise.all([
      searchCriteria
        ? this.elementDiscovery.findAlternativeElements({
            originalSelector: selector,
            searchCriteria,
            maxResults: maxAlternatives,
          })
        : Promise.resolve([]),
      this.pageAnalyzer.analyzePageStructure(),
    ]);

    const suggestions = this.generateElementNotFoundSuggestions(
      pageStructure,
      alternatives
    );

    const enrichedError = new Error(
      this.enhanceErrorMessage(originalError, alternatives)
    ) as EnrichedError;
    enrichedError.originalError = originalError;
    enrichedError.alternatives = alternatives;
    enrichedError.pageStructure = pageStructure;
    enrichedError.diagnosticInfo = pageStructure; // Set diagnosticInfo for test compatibility
    enrichedError.suggestions = suggestions;

    return enrichedError;
  }

  async enrichTimeoutError(
    options: TimeoutErrorOptions
  ): Promise<EnrichedError> {
    const { originalError, operation, selector } = options;

    const pageStructure = await this.pageAnalyzer.analyzePageStructure();
    const suggestions = this.generateTimeoutSuggestions(
      pageStructure,
      operation,
      selector
    );

    const enrichedError = new Error(originalError.message) as EnrichedError;
    enrichedError.originalError = originalError;
    enrichedError.pageStructure = pageStructure;
    enrichedError.diagnosticInfo = pageStructure; // Set diagnosticInfo for test compatibility
    enrichedError.suggestions = suggestions;

    return enrichedError;
  }

  async enrichBatchFailureError(
    options: BatchFailureOptions
  ): Promise<EnrichedError> {
    const { originalError, failedStep, executedSteps } = options;

    const pageStructure = await this.pageAnalyzer.analyzePageStructure();
    const suggestions = this.generateBatchFailureSuggestions(
      pageStructure,
      failedStep
    );

    const enrichedError = new Error(originalError.message) as EnrichedError;
    enrichedError.originalError = originalError;
    enrichedError.pageStructure = pageStructure;
    enrichedError.diagnosticInfo = pageStructure; // Set diagnosticInfo for test compatibility
    enrichedError.suggestions = suggestions;
    enrichedError.batchContext = {
      failedStep,
      executedSteps,
    };

    return enrichedError;
  }

  private enhanceErrorMessage(
    originalError: Error,
    alternatives: AlternativeElement[]
  ): string {
    let message = originalError.message;

    if (alternatives.length > 0) {
      message += '\n\nAlternative elements found:';
      for (const [index, alt] of alternatives.entries()) {
        message += `
${index + 1}. ${alt.selector} (confidence: ${(alt.confidence * 100).toFixed(0)}%) - ${alt.reason}`;
      }
    }

    return message;
  }

  private generateElementNotFoundSuggestions(
    pageStructure: PageStructureAnalysis,
    alternatives: AlternativeElement[]
  ): string[] {
    const suggestions: string[] = [];

    if (alternatives.length > 0) {
      suggestions.push(
        `Try using one of the ${alternatives.length} alternative elements found`
      );
      if (alternatives[0].confidence > 0.8) {
        suggestions.push(
          `High confidence match available: ${alternatives[0].selector}`
        );
      }
    }

    // Use common error enrichment utilities for additional suggestions
    const commonSuggestions = generateSuggestions(
      new Error('Element not found'),
      {
        operation: 'findElement',
        component: 'ErrorEnrichment',
      }
    );
    suggestions.push(...commonSuggestions);

    if (pageStructure.iframes.detected) {
      suggestions.push('Element might be inside an iframe');
      if (pageStructure.iframes.inaccessible.length > 0) {
        suggestions.push(
          'Some iframes are not accessible - check cross-origin restrictions'
        );
      }
    }

    if (pageStructure.modalStates.blockedBy.length > 0) {
      suggestions.push('Page has active modal dialog - handle it first');
    }

    if (pageStructure.elements.missingAria > 0) {
      suggestions.push(
        'Some elements lack proper ARIA attributes - consider using text-based selectors'
      );
    }

    return deduplicate(suggestions); // Remove duplicates
  }

  private generateTimeoutSuggestions(
    pageStructure: PageStructureAnalysis,
    operation: string,
    selector?: string
  ): string[] {
    // Use common error enrichment utilities
    const commonSuggestions = generateSuggestions(new Error('timeout'), {
      operation,
      component: 'ErrorEnrichment',
      selector,
    });

    const suggestions: string[] = [...commonSuggestions];

    if (pageStructure.modalStates.blockedBy.length > 0) {
      suggestions.push(
        `Page has active modal dialog - handle it before performing ${operation}`
      );
    }

    if (pageStructure.iframes.detected) {
      suggestions.push('Element might be inside an iframe');
    }

    suggestions.push(
      `Wait for page load completion before performing ${operation}`
    );

    return deduplicate(suggestions); // Remove duplicates
  }

  private generateBatchFailureSuggestions(
    pageStructure: PageStructureAnalysis,
    failedStep: BatchFailureContext['failedStep']
  ): string[] {
    const suggestions: string[] = [];

    suggestions.push(
      `Batch execution failed at step ${failedStep.stepIndex} (${failedStep.toolName})`
    );

    if (pageStructure.modalStates.blockedBy.length > 0) {
      suggestions.push(
        'Modal dialog detected - may block subsequent operations'
      );
    }

    if (failedStep.selector) {
      suggestions.push(
        `Failed selector: ${failedStep.selector} - check element availability`
      );
    }

    suggestions.push('Consider adding wait steps between operations');
    suggestions.push('Verify page state changes after each navigation step');

    return suggestions;
  }
}
