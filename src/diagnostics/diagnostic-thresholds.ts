/**
 * DiagnosticThresholds - Diagnostic system threshold management class
 * Centralizes all hardcoded thresholds
 */

import type { MetricsThresholds } from '../types/performance.js';
import type {
  BaseMetricsThresholds,
  PartialBaseMetricsThresholds,
} from '../types/threshold-base.js';

// Configuration interface now extends the consolidated base structure
export interface DiagnosticThresholdsConfig
  extends PartialBaseMetricsThresholds {}

// Fully resolved config type now extends the complete base structure
export interface ResolvedDiagnosticThresholdsConfig
  extends BaseMetricsThresholds {}

/**
 * Default threshold settings
 * Consolidates all hardcoded values here
 */

import { THRESHOLDS, TIMEOUTS } from '../config/constants.js';

const DEFAULT_THRESHOLDS: ResolvedDiagnosticThresholdsConfig = {
  executionTime: {
    pageAnalysis: TIMEOUTS.PAGE_ANALYSIS_TIMEOUT,
    elementDiscovery: TIMEOUTS.ELEMENT_DISCOVERY_TIMEOUT,
    resourceMonitoring: 200,
    parallelAnalysis: TIMEOUTS.PARALLEL_ANALYSIS_TIMEOUT,
  },
  memory: {
    maxMemoryUsage: 100 * 1024 * 1024,
    memoryLeakThreshold: 50 * 1024 * 1024,
    gcTriggerThreshold: 80 * 1024 * 1024,
  },
  performance: {
    domElementLimit: 10_000,
    maxDepthLimit: 50,
    largeSubtreeThreshold: THRESHOLDS.LARGE_SUBTREE_ELEMENTS,
  },
  dom: {
    totalElements: 10_000,
    maxDepth: 50,
    largeSubtrees: 10,
    elementsWarning: THRESHOLDS.ELEMENTS_WARNING,
    elementsDanger: THRESHOLDS.ELEMENTS_DANGER,
    depthWarning: 15,
    depthDanger: 20,
    largeSubtreeThreshold: THRESHOLDS.SMALL_SUBTREE_ELEMENTS,
  },
  interaction: {
    clickableElements: 100,
    formElements: 50,
    clickableHigh: 100,
  },
  layout: {
    fixedElements: 10,
    highZIndexElements: 5,
    highZIndexThreshold: THRESHOLDS.HIGH_Z_INDEX,
    excessiveZIndexThreshold: 9999,
  },
};

/**
 * Validation rule type for threshold validation
 */
type ValidationRule<T> = (value: T, errors: string[]) => void;

/**
 * Create a validation rule for positive numbers in an object
 */
function createPositiveNumberRule<T>(
  fieldName: string,
  getValue: (obj: T) => number
): ValidationRule<T> {
  return (obj: T, errors: string[]) => {
    if (getValue(obj) <= 0) {
      errors.push(`${fieldName} must be positive`);
    }
  };
}

/**
 * Create a comparison validation rule
 */
function createComparisonRule<T>(
  getValue1: (obj: T) => number,
  getValue2: (obj: T) => number,
  message: string
): ValidationRule<T> {
  return (obj: T, errors: string[]) => {
    if (getValue2(obj) <= getValue1(obj)) {
      errors.push(message);
    }
  };
}

/**
 * Configuration merger helper functions for type-safe property merging
 */
function _mergeExecutionTimeConfig(
  result: ResolvedDiagnosticThresholdsConfig,
  config: DiagnosticThresholdsConfig
): void {
  if (config.executionTime) {
    Object.assign(result.executionTime, config.executionTime);
  }
}

function _mergeMemoryConfig(
  result: ResolvedDiagnosticThresholdsConfig,
  config: DiagnosticThresholdsConfig
): void {
  if (config.memory) {
    Object.assign(result.memory, config.memory);
  }
}

function _mergePerformanceConfig(
  result: ResolvedDiagnosticThresholdsConfig,
  config: DiagnosticThresholdsConfig
): void {
  if (config.performance) {
    Object.assign(result.performance, config.performance);
  }
}

function _mergeDomConfig(
  result: ResolvedDiagnosticThresholdsConfig,
  config: DiagnosticThresholdsConfig
): void {
  if (config.dom) {
    Object.assign(result.dom, config.dom);
  }
}

function _mergeInteractionConfig(
  result: ResolvedDiagnosticThresholdsConfig,
  config: DiagnosticThresholdsConfig
): void {
  if (config.interaction) {
    Object.assign(result.interaction, config.interaction);
  }
}

function _mergeLayoutConfig(
  result: ResolvedDiagnosticThresholdsConfig,
  config: DiagnosticThresholdsConfig
): void {
  if (config.layout) {
    Object.assign(result.layout, config.layout);
  }
}

/**
 * Diagnostic system threshold management (singleton)
 * Supports configuration validation, default value fallback, and runtime configuration changes
 */
export class DiagnosticThresholds {
  private static instance: DiagnosticThresholds | null = null;
  private currentThresholds: ResolvedDiagnosticThresholdsConfig;

  private constructor(initialConfig?: DiagnosticThresholdsConfig) {
    this.currentThresholds = this.mergeWithDefaults(initialConfig ?? {});
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
    const previousThresholds = { ...this.currentThresholds };
    try {
      const newThresholds = this.mergeWithCurrentThresholds(partialConfig);
      this.validateThresholds(newThresholds);
      this.currentThresholds = newThresholds;
    } catch (error) {
      // Restore previous thresholds on validation error
      this.currentThresholds = previousThresholds;
      throw error;
    }
  }

  /**
   * Merge configuration with default values using generic utility
   * Ensures all properties are defined in a type-safe manner
   */

  private mergeWithDefaults(
    config: DiagnosticThresholdsConfig
  ): ResolvedDiagnosticThresholdsConfig {
    const result = JSON.parse(
      JSON.stringify(DEFAULT_THRESHOLDS)
    ) as ResolvedDiagnosticThresholdsConfig;

    // Use type-safe merger functions for all configuration sections
    if (config.executionTime) {
      Object.assign(result.executionTime, config.executionTime);
    }
    if (config.memory) {
      Object.assign(result.memory, config.memory);
    }
    if (config.performance) {
      Object.assign(result.performance, config.performance);
    }
    if (config.dom) {
      Object.assign(result.dom, config.dom);
    }
    if (config.interaction) {
      Object.assign(result.interaction, config.interaction);
    }
    if (config.layout) {
      Object.assign(result.layout, config.layout);
    }

    return result;
  }

  /**
   * Merge partial configuration with current thresholds
   */
  private mergeWithCurrentThresholds(
    config: DiagnosticThresholdsConfig
  ): ResolvedDiagnosticThresholdsConfig {
    const result = JSON.parse(
      JSON.stringify(this.currentThresholds)
    ) as ResolvedDiagnosticThresholdsConfig;

    // Use type-safe merger functions for all configuration sections
    if (config.executionTime) {
      Object.assign(result.executionTime, config.executionTime);
    }
    if (config.memory) {
      Object.assign(result.memory, config.memory);
    }
    if (config.performance) {
      Object.assign(result.performance, config.performance);
    }
    if (config.dom) {
      Object.assign(result.dom, config.dom);
    }
    if (config.interaction) {
      Object.assign(result.interaction, config.interaction);
    }
    if (config.layout) {
      Object.assign(result.layout, config.layout);
    }

    return result;
  }

  /**
   * Validate threshold configuration using rule-based approach
   */
  private validateThresholds(
    thresholds: ResolvedDiagnosticThresholdsConfig
  ): void {
    const errors: string[] = [];

    // Define validation rules with proper typing
    const executionTimeRules: ValidationRule<
      ResolvedDiagnosticThresholdsConfig['executionTime']
    >[] = [
      createPositiveNumberRule(
        'pageAnalysis execution time',
        (exec) => exec.pageAnalysis
      ),
      createPositiveNumberRule(
        'elementDiscovery execution time',
        (exec) => exec.elementDiscovery
      ),
      createPositiveNumberRule(
        'resourceMonitoring execution time',
        (exec) => exec.resourceMonitoring
      ),
      createPositiveNumberRule(
        'parallelAnalysis execution time',
        (exec) => exec.parallelAnalysis
      ),
    ];

    const memoryRules: ValidationRule<
      ResolvedDiagnosticThresholdsConfig['memory']
    >[] = [
      createPositiveNumberRule('maxMemoryUsage', (mem) => mem.maxMemoryUsage),
      createPositiveNumberRule(
        'memoryLeakThreshold',
        (mem) => mem.memoryLeakThreshold
      ),
      createPositiveNumberRule(
        'gcTriggerThreshold',
        (mem) => mem.gcTriggerThreshold
      ),
      createComparisonRule(
        (mem) => mem.memoryLeakThreshold,
        (mem) => mem.maxMemoryUsage,
        'memoryLeakThreshold should be less than maxMemoryUsage'
      ),
    ];

    const domRules: ValidationRule<
      ResolvedDiagnosticThresholdsConfig['dom']
    >[] = [
      createPositiveNumberRule('elementsWarning', (dom) => dom.elementsWarning),
      createPositiveNumberRule('depthWarning', (dom) => dom.depthWarning),
      createPositiveNumberRule(
        'largeSubtreeThreshold',
        (dom) => dom.largeSubtreeThreshold
      ),
      createComparisonRule(
        (dom) => dom.elementsWarning,
        (dom) => dom.elementsDanger,
        'elementsDanger must be greater than elementsWarning'
      ),
      createComparisonRule(
        (dom) => dom.depthWarning,
        (dom) => dom.depthDanger,
        'depthDanger must be greater than depthWarning'
      ),
    ];

    const interactionRules: ValidationRule<
      ResolvedDiagnosticThresholdsConfig['interaction']
    >[] = [
      createPositiveNumberRule(
        'clickableElements threshold',
        (inter) => inter.clickableElements
      ),
      createPositiveNumberRule(
        'formElements threshold',
        (inter) => inter.formElements
      ),
    ];

    const layoutRules: ValidationRule<
      ResolvedDiagnosticThresholdsConfig['layout']
    >[] = [
      createPositiveNumberRule(
        'highZIndexThreshold',
        (layout) => layout.highZIndexThreshold
      ),
      createComparisonRule(
        (layout) => layout.highZIndexThreshold,
        (layout) => layout.excessiveZIndexThreshold,
        'excessiveZIndexThreshold must be greater than highZIndexThreshold'
      ),
    ];

    // Apply validation rules
    this.applyValidationRules(
      thresholds.executionTime,
      executionTimeRules,
      errors
    );
    this.applyValidationRules(thresholds.memory, memoryRules, errors);
    this.applyValidationRules(thresholds.dom, domRules, errors);
    this.applyValidationRules(thresholds.interaction, interactionRules, errors);
    this.applyValidationRules(thresholds.layout, layoutRules, errors);

    if (errors.length > 0) {
      throw new Error(`Invalid threshold configuration: ${errors.join(', ')}`);
    }
  }

  /**
   * Apply validation rules to a threshold section
   */
  private applyValidationRules<T>(
    section: T,
    rules: ValidationRule<T>[],
    errors: string[]
  ): void {
    for (const rule of rules) {
      rule(section, errors);
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

/**
 * Fluent configuration builder for creating DiagnosticThresholdsConfig
 * Provides a more convenient API for configuration construction
 */
export class ThresholdConfigBuilder {
  private readonly config: DiagnosticThresholdsConfig = {};

  /**
   * Configure execution time thresholds
   */
  executionTime(
    config: Partial<DiagnosticThresholdsConfig['executionTime']>
  ): this {
    this.config.executionTime = { ...this.config.executionTime, ...config };
    return this;
  }

  /**
   * Configure memory thresholds
   */
  memory(config: Partial<DiagnosticThresholdsConfig['memory']>): this {
    this.config.memory = { ...this.config.memory, ...config };
    return this;
  }

  /**
   * Configure performance thresholds
   */
  performance(
    config: Partial<DiagnosticThresholdsConfig['performance']>
  ): this {
    this.config.performance = { ...this.config.performance, ...config };
    return this;
  }

  /**
   * Configure DOM thresholds
   */
  dom(config: Partial<DiagnosticThresholdsConfig['dom']>): this {
    this.config.dom = { ...this.config.dom, ...config };
    return this;
  }

  /**
   * Configure interaction thresholds
   */
  interaction(
    config: Partial<DiagnosticThresholdsConfig['interaction']>
  ): this {
    this.config.interaction = { ...this.config.interaction, ...config };
    return this;
  }

  /**
   * Configure layout thresholds
   */
  layout(config: Partial<DiagnosticThresholdsConfig['layout']>): this {
    this.config.layout = { ...this.config.layout, ...config };
    return this;
  }

  /**
   * Build the final configuration
   */
  build(): DiagnosticThresholdsConfig {
    return { ...this.config };
  }

  /**
   * Create a DiagnosticThresholds instance with the built configuration
   */
  create(): DiagnosticThresholds {
    return DiagnosticThresholds.getInstance(this.build());
  }

  /**
   * Static factory method for creating a new builder
   */
  static create(): ThresholdConfigBuilder {
    return new ThresholdConfigBuilder();
  }
}
