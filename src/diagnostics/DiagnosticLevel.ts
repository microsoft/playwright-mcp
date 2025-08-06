/**
 * Diagnostic level configuration for controlling the depth of diagnostic information
 */

export enum DiagnosticLevel {
  /** No diagnostics - errors are returned as-is without enhancement */
  NONE = 'none',
  
  /** Basic diagnostics - only critical error information */
  BASIC = 'basic',
  
  /** Standard diagnostics - includes alternative element suggestions */
  STANDARD = 'standard',
  
  /** Detailed diagnostics - includes page analysis and performance metrics */
  DETAILED = 'detailed',
  
  /** Full diagnostics - includes all available diagnostic information */
  FULL = 'full'
}

export interface DiagnosticConfig {
  /** Overall diagnostic level */
  level: DiagnosticLevel;
  
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
  private static defaultConfig: DiagnosticConfig = {
    level: DiagnosticLevel.STANDARD,
    features: undefined,
    thresholds: {
      maxDiagnosticTime: 300
    }
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
      level: partial.level || DiagnosticLevelManager.defaultConfig.level,
      features: partial.features ? { ...partial.features } : undefined,
      thresholds: {
        ...DiagnosticLevelManager.defaultConfig.thresholds,
        ...partial.thresholds
      }
    };
  }

  /**
   * Check if a feature should be enabled based on level and feature toggles
   */
  shouldEnableFeature(feature: keyof NonNullable<DiagnosticConfig['features']>): boolean {
    // First check explicit feature toggle
    if (this.config.features?.[feature] !== undefined) {
      return this.config.features[feature]!;
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
   * Get the maximum number of alternatives to suggest
   */
  getMaxAlternatives(): number {
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
    this.config = this.mergeConfig({ ...this.config, ...partial });
  }

  /**
   * Get diagnostic time threshold
   */
  getMaxDiagnosticTime(): number {
    return this.config.thresholds?.maxDiagnosticTime || 300;
  }
}

// Export a singleton instance for global configuration
export const globalDiagnosticConfig = new DiagnosticLevelManager();