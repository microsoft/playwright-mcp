/**
 * Enhanced error handler that integrates diagnostic information with unified system support
 */
import { PageAnalyzer } from './PageAnalyzer.js';
import { ElementDiscovery } from './ElementDiscovery.js';
import { ErrorEnrichment } from './ErrorEnrichment.js';
import { DiagnosticLevelManager } from './DiagnosticLevel.js';
import { DiagnosticError } from './DiagnosticError.js';
export class EnhancedErrorHandler {
    page;
    pageAnalyzer;
    elementDiscovery;
    errorEnrichment;
    diagnosticManager;
    errorHistory = [];
    maxErrorHistory = 100;
    constructor(page, diagnosticConfig) {
        this.page = page;
        this.pageAnalyzer = new PageAnalyzer(page);
        this.elementDiscovery = new ElementDiscovery(page);
        this.errorEnrichment = new ErrorEnrichment(page);
        this.diagnosticManager = new DiagnosticLevelManager(diagnosticConfig);
        this.maxErrorHistory = diagnosticConfig?.maxErrorHistory || 100;
    }
    async enhancePlaywrightError(options) {
        const { error, operation, selector, context } = options;
        // Check if diagnostics should be skipped entirely
        if (this.diagnosticManager.shouldSkipDiagnostics()) {
            return error;
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
            return enrichedError;
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
        let diagnosticInfo;
        if (this.diagnosticManager.shouldEnableFeature('pageAnalysis')) {
            diagnosticInfo = await this.pageAnalyzer.analyzePageStructure();
        }
        const suggestions = diagnosticInfo ? this.generateGeneralSuggestions(error, operation, diagnosticInfo) : [];
        const enhancedError = new Error(error.message);
        enhancedError.originalError = error;
        if (diagnosticInfo) {
            enhancedError.diagnosticInfo = diagnosticInfo;
        }
        enhancedError.suggestions = suggestions;
        return enhancedError;
    }
    async enhanceTimeoutError(options) {
        const { error, operation, selector, timeout } = options;
        const enrichedError = await this.errorEnrichment.enrichTimeoutError({
            originalError: error,
            operation,
            selector
        });
        // Add timeout-specific information
        const contextInfo = await this.analyzeFrameContext();
        enrichedError.contextInfo = contextInfo;
        return enrichedError;
    }
    async enhanceContextError(options) {
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
        const enhancedError = new Error(error.message);
        enhancedError.originalError = error;
        enhancedError.contextInfo = contextInfo;
        enhancedError.diagnosticInfo = diagnosticInfo;
        enhancedError.suggestions = suggestions;
        return enhancedError;
    }
    async enhancePerformanceError(options) {
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
        const error = new Error(`Performance issue: ${operation} operation exceeded threshold`);
        error.performanceInfo = performanceInfo;
        error.diagnosticInfo = diagnosticInfo;
        error.suggestions = suggestions;
        return error;
    }
    async enhanceToolError(options) {
        const { toolName, error, selector, toolArgs } = options;
        const diagnosticInfo = await this.pageAnalyzer.analyzePageStructure();
        const toolContext = {
            toolName,
            toolArgs: toolArgs || {}
        };
        const suggestions = this.generateToolSpecificSuggestions(toolName, error, diagnosticInfo);
        const enhancedError = new Error(error.message);
        enhancedError.originalError = error;
        enhancedError.toolContext = toolContext;
        enhancedError.diagnosticInfo = diagnosticInfo;
        enhancedError.suggestions = suggestions;
        return enhancedError;
    }
    async analyzeFrameContext() {
        const frames = await this.page.frames();
        const mainFrame = this.page.mainFrame();
        return {
            availableFrames: frames.length,
            currentFrame: mainFrame.name() || 'main'
        };
    }
    generateGeneralSuggestions(error, operation, diagnosticInfo) {
        const suggestions = [];
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
    generateToolSpecificSuggestions(toolName, error, diagnosticInfo) {
        const suggestions = [];
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
    createDiagnosticError(error, component, operation, executionTime, memoryUsage) {
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
    async processUnifiedError(error, component, operation, context) {
        const startTime = Date.now();
        try {
            let diagnosticError;
            if (error instanceof DiagnosticError) {
                diagnosticError = error;
            }
            else {
                diagnosticError = this.createDiagnosticError(error, component, operation, context?.executionTime, context?.memoryUsage);
            }
            // Apply performance-based error analysis
            if (context?.performanceThreshold && context?.executionTime) {
                if (context.executionTime > context.performanceThreshold) {
                    const perfError = DiagnosticError.performance(`Operation ${operation} exceeded performance threshold`, component, operation, context.executionTime, context.performanceThreshold);
                    // Merge suggestions from performance analysis
                    diagnosticError.suggestions.push(...perfError.suggestions);
                }
            }
            // Apply contextual error enrichment if diagnostic level allows
            if (this.diagnosticManager.shouldEnableFeature('alternativeSuggestions')) {
                const contextualSuggestions = await this.generateContextualSuggestions(diagnosticError, component, operation, context);
                diagnosticError.suggestions.push(...contextualSuggestions);
            }
            // Pattern-based error analysis from history
            const similarErrors = this.findSimilarErrors(diagnosticError, component);
            if (similarErrors.length > 0) {
                const patternSuggestions = this.generatePatternBasedSuggestions(similarErrors);
                diagnosticError.suggestions.push(...patternSuggestions);
            }
            return diagnosticError;
        }
        catch (processingError) {
            // Fallback: create simple diagnostic error if processing fails
            console.warn('[EnhancedErrorHandler] Error processing failed:', processingError);
            return DiagnosticError.from(error, component, operation, {
                executionTime: Date.now() - startTime
            });
        }
    }
    async generateContextualSuggestions(error, component, operation, context) {
        const suggestions = [];
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
        }
        catch (contextError) {
            console.warn('[EnhancedErrorHandler] Failed to generate contextual suggestions:', contextError);
        }
        return suggestions;
    }
    addToErrorHistory(error, component) {
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
    findSimilarErrors(error, component) {
        const timeWindow = 300000; // 5 minutes
        const now = Date.now();
        return this.errorHistory
            .filter(entry => entry.component === component &&
            entry.error.operation === error.operation &&
            now - entry.timestamp < timeWindow)
            .map(entry => entry.error)
            .slice(-5); // Last 5 similar errors
    }
    generatePatternBasedSuggestions(similarErrors) {
        const suggestions = [];
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
    findCommonSuggestions(errors) {
        const suggestionCounts = new Map();
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
    markErrorResolved(errorId) {
        const entry = this.errorHistory.find(e => e.error.timestamp.toString() === errorId ||
            e.error.message.includes(errorId));
        if (entry) {
            entry.resolved = true;
        }
    }
    /**
     * Get error statistics for monitoring
     */
    getErrorStatistics() {
        const now = Date.now();
        const recentTimeWindow = 600000; // 10 minutes
        const recentErrors = this.errorHistory.filter(e => now - e.timestamp < recentTimeWindow);
        const resolvedErrors = this.errorHistory.filter(e => e.resolved);
        const errorsByComponent = {
            PageAnalyzer: 0,
            ElementDiscovery: 0,
            ResourceManager: 0,
            ErrorHandler: 0,
            ConfigManager: 0,
            UnifiedSystem: 0
        };
        const errorsByOperation = {};
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
    clearErrorHistory() {
        this.errorHistory = [];
    }
    /**
     * Get recent errors for debugging
     */
    getRecentErrors(limit = 10) {
        return this.errorHistory.slice(-limit);
    }
}
