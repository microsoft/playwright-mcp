/**
 * Structured error for diagnostic operations with enhanced context
 */
/**
 * Enhanced error class for diagnostic system operations
 * Provides structured error information with component context
 */
export class DiagnosticError extends Error {
    timestamp;
    component;
    operation;
    originalError;
    executionTime;
    memoryUsage;
    performanceImpact;
    suggestions;
    context;
    constructor(message, context, originalError) {
        const enhancedMessage = `[${context.component}:${context.operation}] ${message}`;
        super(enhancedMessage);
        this.name = 'DiagnosticError';
        this.timestamp = context.timestamp;
        this.component = context.component;
        this.operation = context.operation;
        this.originalError = originalError;
        this.executionTime = context.executionTime;
        this.memoryUsage = context.memoryUsage;
        this.performanceImpact = context.performanceImpact || 'low';
        this.suggestions = context.suggestions || [];
        this.context = context.context;
        // Maintain stack trace for debugging
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, DiagnosticError);
        }
    }
    /**
     * Create a DiagnosticError from a standard Error
     */
    static from(error, component, operation, additionalContext) {
        return new DiagnosticError(error.message, {
            timestamp: Date.now(),
            component,
            operation,
            ...additionalContext
        }, error);
    }
    /**
     * Create a performance-related DiagnosticError
     */
    static performance(message, component, operation, executionTime, threshold) {
        const impact = executionTime > threshold * 3 ? 'high' :
            executionTime > threshold * 2 ? 'medium' : 'low';
        return new DiagnosticError(`Performance issue: ${message} (${executionTime}ms > ${threshold}ms)`, {
            timestamp: Date.now(),
            component,
            operation,
            executionTime,
            performanceImpact: impact,
            suggestions: [
                `Operation took longer than expected (${executionTime}ms vs ${threshold}ms threshold)`,
                'Consider optimizing this operation or increasing timeout thresholds'
            ]
        });
    }
    /**
     * Create a resource-related DiagnosticError
     */
    static resource(message, component, operation, memoryUsage, memoryLimit) {
        const impact = memoryUsage > memoryLimit * 2 ? 'high' :
            memoryUsage > memoryLimit * 1.5 ? 'medium' : 'low';
        return new DiagnosticError(`Resource issue: ${message} (${(memoryUsage / 1024 / 1024).toFixed(2)}MB)`, {
            timestamp: Date.now(),
            component,
            operation,
            memoryUsage,
            performanceImpact: impact,
            suggestions: [
                `Memory usage exceeded expectations (${(memoryUsage / 1024 / 1024).toFixed(2)}MB vs ${(memoryLimit / 1024 / 1024).toFixed(2)}MB limit)`,
                'Consider enabling resource cleanup or reducing analysis scope'
            ]
        });
    }
    /**
     * Convert error to structured JSON for logging
     */
    toJSON() {
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
            originalError: this.originalError ? {
                name: this.originalError.name,
                message: this.originalError.message,
                stack: this.originalError.stack
            } : undefined
        };
    }
    /**
     * Format error for human-readable display
     */
    toString() {
        const parts = [this.message];
        if (this.executionTime !== undefined) {
            parts.push(`Execution Time: ${this.executionTime}ms`);
        }
        if (this.memoryUsage !== undefined) {
            parts.push(`Memory Usage: ${(this.memoryUsage / 1024 / 1024).toFixed(2)}MB`);
        }
        if (this.suggestions.length > 0) {
            parts.push('Suggestions:');
            this.suggestions.forEach(suggestion => {
                parts.push(`  - ${suggestion}`);
            });
        }
        return parts.join('\n');
    }
}
