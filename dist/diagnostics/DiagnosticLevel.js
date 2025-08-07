/**
 * Diagnostic level configuration for controlling the depth of diagnostic information
 */
export var DiagnosticLevel;
(function (DiagnosticLevel) {
    /** No diagnostics - errors are returned as-is without enhancement */
    DiagnosticLevel["NONE"] = "none";
    /** Basic diagnostics - only critical error information */
    DiagnosticLevel["BASIC"] = "basic";
    /** Standard diagnostics - includes alternative element suggestions */
    DiagnosticLevel["STANDARD"] = "standard";
    /** Detailed diagnostics - includes page analysis and performance metrics */
    DiagnosticLevel["DETAILED"] = "detailed";
    /** Full diagnostics - includes all available diagnostic information */
    DiagnosticLevel["FULL"] = "full";
})(DiagnosticLevel || (DiagnosticLevel = {}));
export class DiagnosticLevelManager {
    static defaultConfig = {
        level: DiagnosticLevel.STANDARD,
        features: undefined,
        thresholds: {
            maxDiagnosticTime: 300
        }
    };
    config;
    constructor(config) {
        this.config = this.mergeConfig(config);
    }
    mergeConfig(partial) {
        if (!partial) {
            return { ...DiagnosticLevelManager.defaultConfig };
        }
        return {
            level: partial.level || DiagnosticLevelManager.defaultConfig.level,
            features: partial.features ? { ...partial.features } : undefined,
            thresholds: {
                ...DiagnosticLevelManager.defaultConfig.thresholds,
                ...partial.thresholds
            }
        };
    }
    /**
     * Get the maximum number of alternatives to suggest
     */
    getMaxAlternatives() {
        // Check top-level setting first
        if (this.config.maxAlternatives !== undefined) {
            return this.config.maxAlternatives;
        }
        // Check if there's a custom threshold first
        if (this.config.thresholds?.maxAlternatives !== undefined) {
            return this.config.thresholds.maxAlternatives;
        }
        // Otherwise use level-based defaults
        switch (this.config.level) {
            case DiagnosticLevel.NONE:
                return 0;
            case DiagnosticLevel.BASIC:
                return 1;
            case DiagnosticLevel.STANDARD:
                return 5;
            case DiagnosticLevel.DETAILED:
            case DiagnosticLevel.FULL:
                return 10;
            default:
                return 5;
        }
    }
    /**
     * Check if diagnostics should be skipped entirely
     */
    shouldSkipDiagnostics() {
        return this.config.level === DiagnosticLevel.NONE;
    }
    /**
     * Get the current configuration
     */
    getConfig() {
        return { ...this.config };
    }
    /**
     * Update configuration at runtime
     */
    updateConfig(partial) {
        this.config = this.mergeConfig({ ...this.config, ...partial });
    }
    /**
     * Compatibility methods for top-level flags
     */
    shouldEnableFeature(feature) {
        // Handle top-level compatibility flags first
        if (feature === 'alternativeSuggestions' && this.config.enableAlternativeSuggestions !== undefined) {
            return this.config.enableAlternativeSuggestions;
        }
        if (feature === 'pageAnalysis' && this.config.enablePageAnalysis !== undefined) {
            return this.config.enablePageAnalysis;
        }
        if (feature === 'performanceMetrics' && this.config.enablePerformanceMetrics !== undefined) {
            return this.config.enablePerformanceMetrics;
        }
        // First check explicit feature toggle
        if (this.config.features?.[feature] !== undefined) {
            return this.config.features[feature];
        }
        // Then check based on level
        switch (this.config.level) {
            case DiagnosticLevel.NONE:
                return false;
            case DiagnosticLevel.BASIC:
                // Only critical features
                return feature === 'iframeDetection' || feature === 'modalDetection';
            case DiagnosticLevel.STANDARD:
                // Standard features but not performance or accessibility
                return feature !== 'performanceTracking' && feature !== 'accessibilityAnalysis';
            case DiagnosticLevel.DETAILED:
                // All features except accessibility
                return feature !== 'accessibilityAnalysis';
            case DiagnosticLevel.FULL:
                // All features enabled
                return true;
            default:
                return false;
        }
    }
    /**
     * Get diagnostic time threshold
     */
    getMaxDiagnosticTime() {
        return this.config.thresholds?.maxDiagnosticTime || 300;
    }
}
// Export a singleton instance for global configuration
export const globalDiagnosticConfig = new DiagnosticLevelManager();
