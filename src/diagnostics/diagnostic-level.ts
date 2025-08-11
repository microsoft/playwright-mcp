/**
 * Diagnostic level configuration for controlling the depth of diagnostic information
 */

export const DiagnosticLevel = {
  /** No diagnostics - errors are returned as-is without enhancement */
  NONE: 'none',

  /** Basic diagnostics - only critical error information */
  BASIC: 'basic',

  /** Standard diagnostics - includes alternative element suggestions */
  STANDARD: 'standard',

  /** Detailed diagnostics - includes page analysis and performance metrics */
  DETAILED: 'detailed',

  /** Full diagnostics - includes all available diagnostic information */
  FULL: 'full',
} as const;

export type DiagnosticLevel =
  (typeof DiagnosticLevel)[keyof typeof DiagnosticLevel];

export interface DiagnosticConfig {
  /** Overall diagnostic level */
  level: DiagnosticLevel;

  /** Enable alternative element suggestions - top level flag for compatibility */
  enableAlternativeSuggestions?: boolean;

  /** Enable page structure analysis - top level flag for compatibility */
  enablePageAnalysis?: boolean;

  /** Enable performance metrics - top level flag for compatibility */
  enablePerformanceMetrics?: boolean;

  /** Enable detailed error information - top level flag for compatibility */
  enableDetailedErrors?: boolean;

  /** Maximum number of alternative elements to suggest */
  maxAlternatives?: number;

  /** Maximum number of errors to keep in history */
  maxErrorHistory?: number;

  /** Feature toggles for fine-grained control */
  features?: {
    /** Enable alternative element suggestions */
    alternativeSuggestions?: boolean;

    /** Enable page structure analysis */
    pageAnalysis?: boolean;

    /** Enable performance tracking */
    performanceTracking?: boolean;

    /** Enable iframe detection */
    iframeDetection?: boolean;

    /** Enable modal state detection */
    modalDetection?: boolean;

    /** Enable accessibility analysis */
    accessibilityAnalysis?: boolean;
  };

  /** Performance thresholds */
  thresholds?: {
    /** Maximum time for diagnostic operations in ms */
    maxDiagnosticTime?: number;

    /** Maximum number of alternative elements to suggest */
    maxAlternatives?: number;
  };
}

export class DiagnosticLevelManager {
  private static readonly defaultConfig: DiagnosticConfig = {
    level: DiagnosticLevel.STANDARD,
    features: undefined,
    thresholds: {
      maxDiagnosticTime: 300,
    },
  };

  private config: DiagnosticConfig;

  constructor(config?: Partial<DiagnosticConfig>) {
    this.config = this.mergeConfig(config);
  }

  private mergeConfig(partial?: Partial<DiagnosticConfig>): DiagnosticConfig {
    if (!partial) {
      return { ...DiagnosticLevelManager.defaultConfig };
    }

    return {
      level: partial.level ?? DiagnosticLevelManager.defaultConfig.level,
      features: partial.features ? { ...partial.features } : undefined,
      thresholds: {
        ...DiagnosticLevelManager.defaultConfig.thresholds,
        ...partial.thresholds,
      },
    };
  }

  /**
   * Get the maximum number of alternatives to suggest
   */
  getMaxAlternatives(): number {
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
  shouldSkipDiagnostics(): boolean {
    return this.config.level === DiagnosticLevel.NONE;
  }

  /**
   * Get the current configuration
   */
  getConfig(): DiagnosticConfig {
    return { ...this.config };
  }

  /**
   * Update configuration at runtime
   */
  updateConfig(partial: Partial<DiagnosticConfig>): void {
    const updatedConfig = this.mergeConfig({ ...this.config, ...partial });
    this.config = updatedConfig;
  }

  /**
   * Compatibility methods for top-level flags
   */

  shouldEnableFeature(feature: string): boolean {
    // Handle top-level compatibility flags first
    if (
      feature === 'alternativeSuggestions' &&
      this.config.enableAlternativeSuggestions !== undefined
    ) {
      return this.config.enableAlternativeSuggestions;
    }

    if (
      feature === 'pageAnalysis' &&
      this.config.enablePageAnalysis !== undefined
    ) {
      return this.config.enablePageAnalysis;
    }

    if (
      feature === 'performanceMetrics' &&
      this.config.enablePerformanceMetrics !== undefined
    ) {
      return this.config.enablePerformanceMetrics;
    }

    // First check explicit feature toggle
    if (
      this.config.features?.[
        feature as keyof NonNullable<DiagnosticConfig['features']>
      ] !== undefined
    ) {
      const featureValue =
        this.config.features[
          feature as keyof NonNullable<DiagnosticConfig['features']>
        ];
      return featureValue ?? false;
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
        return (
          feature !== 'performanceTracking' &&
          feature !== 'accessibilityAnalysis'
        );

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
  getMaxDiagnosticTime(): number {
    return this.config.thresholds?.maxDiagnosticTime ?? 300;
  }
}

// Export a singleton instance for global configuration
export const globalDiagnosticConfig = new DiagnosticLevelManager();
