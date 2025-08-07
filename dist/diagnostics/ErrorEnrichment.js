/**
 * Error enrichment with diagnostic information and suggestions
 */
import { PageAnalyzer } from './PageAnalyzer.js';
import { ElementDiscovery } from './ElementDiscovery.js';
export class ErrorEnrichment {
    page;
    pageAnalyzer;
    elementDiscovery;
    constructor(page) {
        this.page = page;
        this.pageAnalyzer = new PageAnalyzer(page);
        this.elementDiscovery = new ElementDiscovery(page);
    }
    async enrichElementNotFoundError(options) {
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
        const enrichedError = new Error(this.enhanceErrorMessage(originalError, alternatives));
        enrichedError.originalError = originalError;
        enrichedError.alternatives = alternatives;
        enrichedError.diagnosticInfo = diagnosticInfo;
        enrichedError.suggestions = suggestions;
        return enrichedError;
    }
    async enrichTimeoutError(options) {
        const { originalError, operation, selector } = options;
        const diagnosticInfo = await this.pageAnalyzer.analyzePageStructure();
        const suggestions = this.generateTimeoutSuggestions(diagnosticInfo, operation, selector);
        const enrichedError = new Error(originalError.message);
        enrichedError.originalError = originalError;
        enrichedError.diagnosticInfo = diagnosticInfo;
        enrichedError.suggestions = suggestions;
        return enrichedError;
    }
    async enrichBatchFailureError(options) {
        const { originalError, failedStep, executedSteps } = options;
        const diagnosticInfo = await this.pageAnalyzer.analyzePageStructure();
        const suggestions = this.generateBatchFailureSuggestions(diagnosticInfo, failedStep);
        const enrichedError = new Error(originalError.message);
        enrichedError.originalError = originalError;
        enrichedError.diagnosticInfo = diagnosticInfo;
        enrichedError.suggestions = suggestions;
        enrichedError.batchContext = {
            failedStep,
            executedSteps
        };
        return enrichedError;
    }
    enhanceErrorMessage(originalError, alternatives) {
        let message = originalError.message;
        if (alternatives.length > 0) {
            message += '\n\nAlternative elements found:';
            alternatives.forEach((alt, index) => {
                message += `\n${index + 1}. ${alt.selector} (confidence: ${(alt.confidence * 100).toFixed(0)}%) - ${alt.reason}`;
            });
        }
        return message;
    }
    generateElementNotFoundSuggestions(diagnosticInfo, alternatives) {
        const suggestions = [];
        if (alternatives.length > 0) {
            suggestions.push(`Try using one of the ${alternatives.length} alternative elements found`);
            if (alternatives[0].confidence > 0.8) {
                suggestions.push(`High confidence match available: ${alternatives[0].selector}`);
            }
        }
        if (diagnosticInfo.iframes.detected) {
            suggestions.push('Element might be inside an iframe');
            if (diagnosticInfo.iframes.inaccessible.length > 0) {
                suggestions.push('Some iframes are not accessible - check cross-origin restrictions');
            }
        }
        if (diagnosticInfo.modalStates.blockedBy.length > 0) {
            suggestions.push(`Page has active modal dialog - handle it first`);
        }
        if (diagnosticInfo.elements.missingAria > 0) {
            suggestions.push('Some elements lack proper ARIA attributes - consider using text-based selectors');
        }
        return suggestions;
    }
    generateTimeoutSuggestions(diagnosticInfo, operation, selector) {
        const suggestions = [];
        if (diagnosticInfo.modalStates.blockedBy.length > 0) {
            suggestions.push(`Page has active modal dialog - handle it before performing ${operation}`);
        }
        if (diagnosticInfo.iframes.detected) {
            suggestions.push('Element might be inside an iframe');
        }
        if (selector) {
            suggestions.push(`Try waiting for element visibility: ${selector}`);
            suggestions.push('Consider increasing timeout for slow-loading elements');
        }
        suggestions.push(`Wait for page load completion before performing ${operation}`);
        return suggestions;
    }
    generateBatchFailureSuggestions(diagnosticInfo, failedStep) {
        const suggestions = [];
        suggestions.push(`Batch execution failed at step ${failedStep.stepIndex} (${failedStep.toolName})`);
        if (diagnosticInfo.modalStates.blockedBy.length > 0) {
            suggestions.push('Modal dialog detected - may block subsequent operations');
        }
        if (failedStep.selector) {
            suggestions.push(`Failed selector: ${failedStep.selector} - check element availability`);
        }
        suggestions.push('Consider adding wait steps between operations');
        suggestions.push('Verify page state changes after each navigation step');
        return suggestions;
    }
}
