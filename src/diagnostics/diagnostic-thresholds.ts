/**
 * DiagnosticThresholds - Diagnostic system threshold management class
 * Centralizes all hardcoded thresholds
 */

import type { MetricsThresholds } from '../types/performance.js';

export interface DiagnosticThresholdsConfig {
  executionTime?: {
    pageAnalysis?: number;
    elementDiscovery?: number;
    resourceMonitoring?: number;
    parallelAnalysis?: number;
  };
  memory?: {
    maxMemoryUsage?: number;
    memoryLeakThreshold?: number;
    gcTriggerThreshold?: number;
  };
  performance?: {
    domElementLimit?: number;
    maxDepthLimit?: number;
    largeSubtreeThreshold?: number;
  };
  dom?: {
    totalElements?: number;
    maxDepth?: number;
    largeSubtrees?: number;
    elementsWarning?: number;
    elementsDanger?: number;
    depthWarning?: number;
    depthDanger?: number;
    largeSubtreeThreshold?: number;
  };
  interaction?: {
    clickableElements?: number;
    formElements?: number;
    clickableHigh?: number;
  };
  layout?: {
    fixedElements?: number;
    highZIndexElements?: number;
    highZIndexThreshold?: number;
    excessiveZIndexThreshold?: number;
  };
}

// Define the fully resolved config type to ensure all properties are required
export interface ResolvedDiagnosticThresholdsConfig {
  executionTime: {
    pageAnalysis: number;
    elementDiscovery: number;
    resourceMonitoring: number;
    parallelAnalysis: number;
  };
  memory: {
    maxMemoryUsage: number;
    memoryLeakThreshold: number;
    gcTriggerThreshold: number;
  };
  performance: {
    domElementLimit: number;
    maxDepthLimit: number;
    largeSubtreeThreshold: number;
  };
  dom: {
    totalElements: number;
    maxDepth: number;
    largeSubtrees: number;
    elementsWarning: number;
    elementsDanger: number;
    depthWarning: number;
    depthDanger: number;
    largeSubtreeThreshold: number;
  };
  interaction: {
    clickableElements: number;
    formElements: number;
    clickableHigh: number;
  };
  layout: {
    fixedElements: number;
    highZIndexElements: number;
    highZIndexThreshold: number;
    excessiveZIndexThreshold: number;
  };
}

/**
 * Default threshold settings
 * Consolidates all hardcoded values here
 */
const DEFAULT_THRESHOLDS: ResolvedDiagnosticThresholdsConfig = {
  executionTime: {
    pageAnalysis: 1000,
    elementDiscovery: 500,
    resourceMonitoring: 200,
    parallelAnalysis: 2000,
  },
  memory: {
    maxMemoryUsage: 100 * 1024 * 1024,
    memoryLeakThreshold: 50 * 1024 * 1024,
    gcTriggerThreshold: 80 * 1024 * 1024,
  },
  performance: {
    domElementLimit: 10_000,
    maxDepthLimit: 50,
    largeSubtreeThreshold: 1000,
  },
  dom: {
    totalElements: 10_000,
    maxDepth: 50,
    largeSubtrees: 10,
    elementsWarning: 1500,
    elementsDanger: 3000,
    depthWarning: 15,
    depthDanger: 20,
    largeSubtreeThreshold: 500,
  },
  interaction: {
    clickableElements: 100,
    formElements: 50,
    clickableHigh: 100,
  },
  layout: {
    fixedElements: 10,
    highZIndexElements: 5,
    highZIndexThreshold: 1000,
    excessiveZIndexThreshold: 9999,
  },
};

/**
 * Diagnostic system threshold management (singleton)
 * Supports configuration validation, default value fallback, and runtime configuration changes
 */
export class DiagnosticThresholds {
  private static instance: DiagnosticThresholds | null = null;
  private currentThresholds: ResolvedDiagnosticThresholdsConfig;

  private constructor(initialConfig?: DiagnosticThresholdsConfig) {
    this.currentThresholds = this.mergeWithDefaults(initialConfig || {});
    this.validateThresholds(this.currentThresholds);
  }

  /**
   * Get singleton instance
   */
  static getInstance(
    config?: DiagnosticThresholdsConfig
  ): DiagnosticThresholds {
    if (!DiagnosticThresholds.instance) {
      DiagnosticThresholds.instance = new DiagnosticThresholds(config);
    } else if (config) {
      // Update configuration to existing instance
      DiagnosticThresholds.instance.updateThresholds(config);
    }
    return DiagnosticThresholds.instance;
  }

  /**
   * Reset instance (for testing)
   */
  static reset(): void {
    DiagnosticThresholds.instance = null;
  }

  /**
   * Get current threshold settings in MetricsThresholds format
   */
  getMetricsThresholds(): MetricsThresholds {
    const thresholds = this.currentThresholds;
    return {
      executionTime: {
        pageAnalysis: thresholds.executionTime.pageAnalysis,
        elementDiscovery: thresholds.executionTime.elementDiscovery,
        resourceMonitoring: thresholds.executionTime.resourceMonitoring,
        parallelAnalysis: thresholds.executionTime.parallelAnalysis,
      },
      memory: {
        maxMemoryUsage: thresholds.memory.maxMemoryUsage,
        memoryLeakThreshold: thresholds.memory.memoryLeakThreshold,
        gcTriggerThreshold: thresholds.memory.gcTriggerThreshold,
      },
      performance: {
        domElementLimit: thresholds.performance.domElementLimit,
        maxDepthLimit: thresholds.performance.maxDepthLimit,
        largeSubtreeThreshold: thresholds.performance.largeSubtreeThreshold,
      },
      dom: {
        totalElements: thresholds.dom.totalElements,
        maxDepth: thresholds.dom.maxDepth,
        largeSubtrees: thresholds.dom.largeSubtrees,
        elementsWarning: thresholds.dom.elementsWarning,
        elementsDanger: thresholds.dom.elementsDanger,
        depthWarning: thresholds.dom.depthWarning,
        depthDanger: thresholds.dom.depthDanger,
        largeSubtreeThreshold: thresholds.dom.largeSubtreeThreshold,
      },
      interaction: {
        clickableElements: thresholds.interaction.clickableElements,
        formElements: thresholds.interaction.formElements,
        clickableHigh: thresholds.interaction.clickableHigh,
      },
      layout: {
        fixedElements: thresholds.layout.fixedElements,
        highZIndexElements: thresholds.layout.highZIndexElements,
        highZIndexThreshold: thresholds.layout.highZIndexThreshold,
        excessiveZIndexThreshold: thresholds.layout.excessiveZIndexThreshold,
      },
    };
  }

  /**
   * Get thresholds for specific categories
   */
  getDomThresholds() {
    return this.currentThresholds.dom;
  }

  getPerformanceThresholds() {
    return this.currentThresholds.performance;
  }

  getInteractionThresholds() {
    return this.currentThresholds.interaction;
  }

  getLayoutThresholds() {
    return this.currentThresholds.layout;
  }

  getExecutionTimeThresholds() {
    return this.currentThresholds.executionTime;
  }

  getMemoryThresholds() {
    return this.currentThresholds.memory;
  }

  /**
   * Update thresholds at runtime
   */
  updateThresholds(partialConfig: DiagnosticThresholdsConfig): void {
    this.currentThresholds = this.mergeWithDefaults(partialConfig);
    this.validateThresholds(this.currentThresholds);
  }

  /**
   * Merge configuration with default values
   * Ensures all properties are defined in a type-safe manner
   */
  private mergeExecutionTimeConfig(
    result: ResolvedDiagnosticThresholdsConfig,
    config: DiagnosticThresholdsConfig
  ): void {
    if (!config.executionTime) {
      return;
    }

    const { executionTime } = config;
    if (executionTime.pageAnalysis !== undefined) {
      result.executionTime.pageAnalysis = executionTime.pageAnalysis;
    }
    if (executionTime.elementDiscovery !== undefined) {
      result.executionTime.elementDiscovery = executionTime.elementDiscovery;
    }
    if (executionTime.resourceMonitoring !== undefined) {
      result.executionTime.resourceMonitoring =
        executionTime.resourceMonitoring;
    }
    if (executionTime.parallelAnalysis !== undefined) {
      result.executionTime.parallelAnalysis = executionTime.parallelAnalysis;
    }
  }

  private mergeMemoryConfig(
    result: ResolvedDiagnosticThresholdsConfig,
    config: DiagnosticThresholdsConfig
  ): void {
    if (!config.memory) {
      return;
    }

    const { memory } = config;
    if (memory.maxMemoryUsage !== undefined) {
      result.memory.maxMemoryUsage = memory.maxMemoryUsage;
    }
    if (memory.memoryLeakThreshold !== undefined) {
      result.memory.memoryLeakThreshold = memory.memoryLeakThreshold;
    }
    if (memory.gcTriggerThreshold !== undefined) {
      result.memory.gcTriggerThreshold = memory.gcTriggerThreshold;
    }
  }

  private mergePerformanceConfig(
    result: ResolvedDiagnosticThresholdsConfig,
    config: DiagnosticThresholdsConfig
  ): void {
    if (!config.performance) {
      return;
    }

    const { performance } = config;
    if (performance.domElementLimit !== undefined) {
      result.performance.domElementLimit = performance.domElementLimit;
    }
    if (performance.maxDepthLimit !== undefined) {
      result.performance.maxDepthLimit = performance.maxDepthLimit;
    }
    if (performance.largeSubtreeThreshold !== undefined) {
      result.performance.largeSubtreeThreshold =
        performance.largeSubtreeThreshold;
    }
  }

  private mergeDomConfig(
    result: ResolvedDiagnosticThresholdsConfig,
    config: DiagnosticThresholdsConfig
  ): void {
    if (!config.dom) {
      return;
    }

    const { dom } = config;
    if (dom.totalElements !== undefined) {
      result.dom.totalElements = dom.totalElements;
    }
    if (dom.maxDepth !== undefined) {
      result.dom.maxDepth = dom.maxDepth;
    }
    if (dom.largeSubtrees !== undefined) {
      result.dom.largeSubtrees = dom.largeSubtrees;
    }
    if (dom.elementsWarning !== undefined) {
      result.dom.elementsWarning = dom.elementsWarning;
    }
    if (dom.elementsDanger !== undefined) {
      result.dom.elementsDanger = dom.elementsDanger;
    }
    if (dom.depthWarning !== undefined) {
      result.dom.depthWarning = dom.depthWarning;
    }
    if (dom.depthDanger !== undefined) {
      result.dom.depthDanger = dom.depthDanger;
    }
    if (dom.largeSubtreeThreshold !== undefined) {
      result.dom.largeSubtreeThreshold = dom.largeSubtreeThreshold;
    }
  }

  private mergeInteractionConfig(
    result: ResolvedDiagnosticThresholdsConfig,
    config: DiagnosticThresholdsConfig
  ): void {
    if (!config.interaction) {
      return;
    }

    const { interaction } = config;
    if (interaction.clickableElements !== undefined) {
      result.interaction.clickableElements = interaction.clickableElements;
    }
    if (interaction.formElements !== undefined) {
      result.interaction.formElements = interaction.formElements;
    }
    if (interaction.clickableHigh !== undefined) {
      result.interaction.clickableHigh = interaction.clickableHigh;
    }
  }

  private mergeLayoutConfig(
    result: ResolvedDiagnosticThresholdsConfig,
    config: DiagnosticThresholdsConfig
  ): void {
    if (!config.layout) {
      return;
    }

    const { layout } = config;
    if (layout.fixedElements !== undefined) {
      result.layout.fixedElements = layout.fixedElements;
    }
    if (layout.highZIndexElements !== undefined) {
      result.layout.highZIndexElements = layout.highZIndexElements;
    }
    if (layout.highZIndexThreshold !== undefined) {
      result.layout.highZIndexThreshold = layout.highZIndexThreshold;
    }
    if (layout.excessiveZIndexThreshold !== undefined) {
      result.layout.excessiveZIndexThreshold = layout.excessiveZIndexThreshold;
    }
  }

  private mergeWithDefaults(
    config: DiagnosticThresholdsConfig
  ): ResolvedDiagnosticThresholdsConfig {
    const result = JSON.parse(
      JSON.stringify(DEFAULT_THRESHOLDS)
    ) as ResolvedDiagnosticThresholdsConfig;

    this.mergeExecutionTimeConfig(result, config);
    this.mergeMemoryConfig(result, config);
    this.mergePerformanceConfig(result, config);
    this.mergeDomConfig(result, config);
    this.mergeInteractionConfig(result, config);
    this.mergeLayoutConfig(result, config);

    return result;
  }

  /**
   * Validate threshold configuration
   */
  private validateThresholds(
    thresholds: ResolvedDiagnosticThresholdsConfig
  ): void {
    const errors: string[] = [];

    this.validateExecutionTimeThresholds(thresholds.executionTime, errors);
    this.validateMemoryThresholds(thresholds.memory, errors);
    this.validateDomThresholds(thresholds.dom, errors);
    this.validateInteractionThresholds(thresholds.interaction, errors);
    this.validateLayoutThresholds(thresholds.layout, errors);

    if (errors.length > 0) {
      throw new Error(`Invalid threshold configuration: ${errors.join(', ')}`);
    }
  }

  /**
   * Validate execution time thresholds
   */
  private validateExecutionTimeThresholds(
    exec: ResolvedDiagnosticThresholdsConfig['executionTime'],
    errors: string[]
  ): void {
    if (exec.pageAnalysis <= 0) {
      errors.push('pageAnalysis execution time must be positive');
    }
    if (exec.elementDiscovery <= 0) {
      errors.push('elementDiscovery execution time must be positive');
    }
    if (exec.resourceMonitoring <= 0) {
      errors.push('resourceMonitoring execution time must be positive');
    }
    if (exec.parallelAnalysis <= 0) {
      errors.push('parallelAnalysis execution time must be positive');
    }
  }

  /**
   * Validate memory thresholds
   */
  private validateMemoryThresholds(
    mem: ResolvedDiagnosticThresholdsConfig['memory'],
    errors: string[]
  ): void {
    if (mem.maxMemoryUsage <= 0) {
      errors.push('maxMemoryUsage must be positive');
    }
    if (mem.memoryLeakThreshold <= 0) {
      errors.push('memoryLeakThreshold must be positive');
    }
    if (mem.gcTriggerThreshold <= 0) {
      errors.push('gcTriggerThreshold must be positive');
    }
    if (mem.memoryLeakThreshold >= mem.maxMemoryUsage) {
      errors.push('memoryLeakThreshold should be less than maxMemoryUsage');
    }
  }

  /**
   * Validate DOM thresholds
   */
  private validateDomThresholds(
    dom: ResolvedDiagnosticThresholdsConfig['dom'],
    errors: string[]
  ): void {
    if (dom.elementsWarning <= 0) {
      errors.push('elementsWarning must be positive');
    }
    if (dom.elementsDanger <= dom.elementsWarning) {
      errors.push('elementsDanger must be greater than elementsWarning');
    }
    if (dom.depthWarning <= 0) {
      errors.push('depthWarning must be positive');
    }
    if (dom.depthDanger <= dom.depthWarning) {
      errors.push('depthDanger must be greater than depthWarning');
    }
    if (dom.largeSubtreeThreshold <= 0) {
      errors.push('largeSubtreeThreshold must be positive');
    }
  }

  /**
   * Validate interaction thresholds
   */
  private validateInteractionThresholds(
    inter: ResolvedDiagnosticThresholdsConfig['interaction'],
    errors: string[]
  ): void {
    if (inter.clickableElements <= 0) {
      errors.push('clickableElements threshold must be positive');
    }
    if (inter.formElements <= 0) {
      errors.push('formElements threshold must be positive');
    }
  }

  /**
   * Validate layout thresholds
   */
  private validateLayoutThresholds(
    layout: ResolvedDiagnosticThresholdsConfig['layout'],
    errors: string[]
  ): void {
    if (layout.highZIndexThreshold <= 0) {
      errors.push('highZIndexThreshold must be positive');
    }
    if (layout.excessiveZIndexThreshold <= layout.highZIndexThreshold) {
      errors.push(
        'excessiveZIndexThreshold must be greater than highZIndexThreshold'
      );
    }
  }

  /**
   * Get configuration diagnostic information
   */
  getConfigDiagnostics(): {
    status: 'valid' | 'invalid';
    customizations: string[];
    warnings: string[];
    defaultsUsed: string[];
  } {
    const customizations: string[] = [];
    const warnings: string[] = [];
    const defaultsUsed: string[] = [];

    // Detect customizations by comparing with default values
    const defaults = DEFAULT_THRESHOLDS;
    const current = this.currentThresholds;

    // Type-safe comparisons using local variables
    const currentDom = current.dom;
    const defaultsDom = defaults.dom;
    const currentLayout = current.layout;
    const defaultsLayout = defaults.layout;

    // Detect DOM threshold customizations
    if (currentDom.elementsWarning !== defaultsDom.elementsWarning) {
      customizations.push(
        `DOM elements warning: ${currentDom.elementsWarning} (default: ${defaultsDom.elementsWarning})`
      );
    }

    if (currentDom.elementsDanger !== defaultsDom.elementsDanger) {
      customizations.push(
        `DOM elements danger: ${currentDom.elementsDanger} (default: ${defaultsDom.elementsDanger})`
      );
    }

    if (currentDom.depthWarning !== defaultsDom.depthWarning) {
      customizations.push(
        `DOM depth warning: ${currentDom.depthWarning} (default: ${defaultsDom.depthWarning})`
      );
    }

    if (currentDom.depthDanger !== defaultsDom.depthDanger) {
      customizations.push(
        `DOM depth danger: ${currentDom.depthDanger} (default: ${defaultsDom.depthDanger})`
      );
    }

    // Detect layout threshold customizations
    if (
      currentLayout.excessiveZIndexThreshold !==
      defaultsLayout.excessiveZIndexThreshold
    ) {
      customizations.push(
        `Z-index excessive: ${currentLayout.excessiveZIndexThreshold} (default: ${defaultsLayout.excessiveZIndexThreshold})`
      );
    }

    // Determine warning level
    if (currentDom.elementsWarning > 2000) {
      warnings.push(
        'DOM elements warning threshold is very high - may not catch performance issues early'
      );
    }

    if (currentDom.depthWarning > 25) {
      warnings.push(
        'DOM depth warning threshold is very high - deeply nested structures may cause performance issues'
      );
    }

    if (currentLayout.excessiveZIndexThreshold < 1000) {
      warnings.push(
        'Excessive z-index threshold is low - may generate false positives'
      );
    }

    // Items using default values
    if (customizations.length === 0) {
      defaultsUsed.push('All thresholds using default values');
    }

    return {
      status: 'valid',
      customizations,
      warnings,
      defaultsUsed,
    };
  }

  /**
   * Reset to default configuration
   */
  resetToDefaults(): void {
    this.currentThresholds = { ...DEFAULT_THRESHOLDS };
  }
}

/**
 * Global utility function: Get current diagnostic thresholds
 */
export function getCurrentThresholds(): DiagnosticThresholds {
  return DiagnosticThresholds.getInstance();
}

/**
 * Global utility function: Get current thresholds in MetricsThresholds format
 */
export function getMetricsThresholds(): MetricsThresholds {
  return getCurrentThresholds().getMetricsThresholds();
}
