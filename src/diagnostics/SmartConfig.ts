/**
 * Unified configuration system for all diagnostic components
 */

import { DiagnosticLevel, type DiagnosticConfig } from './DiagnosticLevel.js';
import { MetricsThresholds } from '../types/performance.js';

export interface PerformanceConfig {
  enableMetricsCollection: boolean;
  enableResourceMonitoring: boolean;
  enablePerformanceWarnings: boolean;
  autoOptimization: boolean;
  thresholds: MetricsThresholds;
}

export interface ErrorHandlingConfig {
  enableErrorEnrichment: boolean;
  enableContextualSuggestions: boolean;
  logLevel: 'error' | 'warn' | 'info' | 'debug';
  maxErrorHistory: number;
  enablePerformanceErrorDetection: boolean;
}

export interface FeatureFlags {
  enableParallelAnalysis: boolean;
  enableSmartHandleManagement: boolean;
  enableAdvancedElementDiscovery: boolean;
  enableResourceLeakDetection: boolean;
  enableRealTimeMonitoring: boolean;
}

export interface SmartConfig {
  // Core configuration
  autoDisposeTimeout: number;
  maxConcurrentHandles: number;
  enableLeakDetection: boolean;
  batchSizeLimit: number;
  parallelAnalysisEnabled: boolean;

  // Diagnostic configuration
  diagnostic: DiagnosticConfig;

  // Performance configuration
  performance: PerformanceConfig;

  // Error handling configuration
  errorHandling: ErrorHandlingConfig;

  // Feature flags
  features: FeatureFlags;

  // Runtime adjustments
  runtime: {
    enableAdaptiveThresholds: boolean;
    enableAutoTuning: boolean;
    statsCollectionEnabled: boolean;
  };
}

export class SmartConfigManager {
  private static instance: SmartConfigManager;
  private config: SmartConfig;
  private listeners: Array<(config: SmartConfig) => void> = [];

  private constructor(initialConfig?: Partial<SmartConfig>) {
    this.config = this.createDefaultConfig();
    if (initialConfig) {
      this.updateConfig(initialConfig);
    }
  }

  static getInstance(initialConfig?: Partial<SmartConfig>): SmartConfigManager {
    if (!SmartConfigManager.instance) {
      SmartConfigManager.instance = new SmartConfigManager(initialConfig);
    }
    return SmartConfigManager.instance;
  }

  private createDefaultConfig(): SmartConfig {
    return {
      autoDisposeTimeout: 30000,
      maxConcurrentHandles: 100,
      enableLeakDetection: true,
      batchSizeLimit: 50,
      parallelAnalysisEnabled: true,

      diagnostic: {
        level: DiagnosticLevel.STANDARD,
        enableAlternativeSuggestions: true,
        enablePageAnalysis: true,
        enablePerformanceMetrics: true,
        maxAlternatives: 5,
        enableDetailedErrors: true
      },

      performance: {
        enableMetricsCollection: true,
        enableResourceMonitoring: true,
        enablePerformanceWarnings: true,
        autoOptimization: true,
        thresholds: {
          executionTime: {
            pageAnalysis: 1000,
            elementDiscovery: 500,
            resourceMonitoring: 200,
            parallelAnalysis: 2000
          },
          memory: {
            maxMemoryUsage: 100 * 1024 * 1024, // 100MB
            memoryLeakThreshold: 50 * 1024 * 1024, // 50MB
            gcTriggerThreshold: 80 * 1024 * 1024  // 80MB
          },
          performance: {
            domElementLimit: 10000,
            maxDepthLimit: 50,
            largeSubtreeThreshold: 1000
          },
          dom: {
            totalElements: 10000,
            maxDepth: 50,
            largeSubtrees: 10,
            elementsWarning: 1500,
            elementsDanger: 3000,
            depthWarning: 15,
            depthDanger: 20,
            largeSubtreeThreshold: 500
          },
          interaction: {
            clickableElements: 100,
            formElements: 50,
            clickableHigh: 100
          },
          layout: {
            fixedElements: 10,
            highZIndexElements: 5,
            highZIndexThreshold: 1000,
            excessiveZIndexThreshold: 9999
          }
        }
      },

      errorHandling: {
        enableErrorEnrichment: true,
        enableContextualSuggestions: true,
        logLevel: 'warn',
        maxErrorHistory: 100,
        enablePerformanceErrorDetection: true
      },

      features: {
        enableParallelAnalysis: true,
        enableSmartHandleManagement: true,
        enableAdvancedElementDiscovery: true,
        enableResourceLeakDetection: true,
        enableRealTimeMonitoring: false
      },

      runtime: {
        enableAdaptiveThresholds: true,
        enableAutoTuning: false,
        statsCollectionEnabled: true
      }
    };
  }

  getConfig(): SmartConfig {
    return { ...this.config };
  }

  updateConfig(updates: Partial<SmartConfig>): void {
    const previousConfig = { ...this.config };
    this.config = this.deepMerge(this.config, updates);
    this.notifyListeners();
    
    // Log significant configuration changes
    if (this.hasSignificantChanges(previousConfig, this.config)) {
      console.info('[SmartConfig] Configuration updated with significant changes:', {
        timestamp: Date.now(),
        changes: this.getConfigDiff(previousConfig, this.config)
      });
    }
  }

  private deepMerge(target: any, source: any): any {
    if (source === null || typeof source !== 'object') {
      return source;
    }

    if (Array.isArray(source)) {
      return [...source];
    }

    const result = { ...target };
    
    for (const key in source) {
      if (source.hasOwnProperty(key)) {
        if (typeof source[key] === 'object' && !Array.isArray(source[key])) {
          result[key] = this.deepMerge(target[key] || {}, source[key]);
        } else {
          result[key] = source[key];
        }
      }
    }

    return result;
  }

  private hasSignificantChanges(prev: SmartConfig, current: SmartConfig): boolean {
    const significantKeys = [
      'parallelAnalysisEnabled',
      'enableLeakDetection',
      'performance.enableResourceMonitoring',
      'features.enableParallelAnalysis',
      'diagnostic.level'
    ];

    return significantKeys.some(key => {
      const prevValue = this.getNestedValue(prev, key);
      const currentValue = this.getNestedValue(current, key);
      return prevValue !== currentValue;
    });
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private getConfigDiff(prev: SmartConfig, current: SmartConfig): Record<string, { from: any; to: any }> {
    const diff: Record<string, { from: any; to: any }> = {};
    
    const significantKeys = [
      'parallelAnalysisEnabled',
      'enableLeakDetection',
      'performance.enableResourceMonitoring',
      'features.enableParallelAnalysis',
      'diagnostic.level'
    ];

    significantKeys.forEach(key => {
      const prevValue = this.getNestedValue(prev, key);
      const currentValue = this.getNestedValue(current, key);
      if (prevValue !== currentValue) {
        diff[key] = { from: prevValue, to: currentValue };
      }
    });

    return diff;
  }

  onConfigChange(listener: (config: SmartConfig) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener(this.config);
      } catch (error) {
        console.warn('[SmartConfig] Error in config change listener:', error);
      }
    });
  }

  // Adaptive threshold management
  adjustThresholds(component: 'pageAnalysis' | 'elementDiscovery' | 'resourceMonitoring', 
                   avgExecutionTime: number, successRate: number): void {
    if (!this.config.runtime.enableAdaptiveThresholds) {
      return;
    }

    const currentThreshold = this.config.performance.thresholds.executionTime[component];
    
    // Increase threshold if average execution time is consistently high but success rate is good
    if (avgExecutionTime > currentThreshold * 0.8 && successRate > 0.9) {
      const newThreshold = Math.min(currentThreshold * 1.2, currentThreshold + 1000);
      this.updateConfig({
        performance: {
          ...this.config.performance,
          thresholds: {
            ...this.config.performance.thresholds,
            executionTime: {
              ...this.config.performance.thresholds.executionTime,
              [component]: newThreshold
            }
          }
        }
      });
    }
    
    // Decrease threshold if execution times are consistently low
    if (avgExecutionTime < currentThreshold * 0.5 && successRate > 0.95) {
      const newThreshold = Math.max(currentThreshold * 0.9, 100);
      this.updateConfig({
        performance: {
          ...this.config.performance,
          thresholds: {
            ...this.config.performance.thresholds,
            executionTime: {
              ...this.config.performance.thresholds.executionTime,
              [component]: newThreshold
            }
          }
        }
      });
    }
  }

  // Environment-specific configuration
  configureForEnvironment(env: 'development' | 'production' | 'testing'): void {
    const envConfigs = {
      development: {
        diagnostic: { level: DiagnosticLevel.FULL },
        performance: { 
          enableMetricsCollection: true,
          enableResourceMonitoring: true,
          enablePerformanceWarnings: true,
          autoOptimization: true,
          thresholds: this.createDefaultConfig().performance.thresholds
        },
        errorHandling: { 
          enableErrorEnrichment: true,
          enableContextualSuggestions: true,
          logLevel: 'debug' as const,
          maxErrorHistory: 100,
          enablePerformanceErrorDetection: true
        },
        features: { 
          enableParallelAnalysis: true,
          enableSmartHandleManagement: true,
          enableAdvancedElementDiscovery: true,
          enableResourceLeakDetection: true,
          enableRealTimeMonitoring: true 
        }
      },
      production: {
        diagnostic: { level: DiagnosticLevel.STANDARD },
        performance: { 
          enableMetricsCollection: true,
          enableResourceMonitoring: true,
          enablePerformanceWarnings: false,
          autoOptimization: true,
          thresholds: this.createDefaultConfig().performance.thresholds
        },
        errorHandling: { 
          enableErrorEnrichment: true,
          enableContextualSuggestions: true,
          logLevel: 'warn' as const,
          maxErrorHistory: 50,
          enablePerformanceErrorDetection: true
        },
        features: { 
          enableParallelAnalysis: true,
          enableSmartHandleManagement: true,
          enableAdvancedElementDiscovery: true,
          enableResourceLeakDetection: true,
          enableRealTimeMonitoring: false 
        }
      },
      testing: {
        diagnostic: { level: DiagnosticLevel.BASIC },
        performance: { 
          enableMetricsCollection: false,
          enableResourceMonitoring: false,
          enablePerformanceWarnings: false,
          autoOptimization: false,
          thresholds: this.createDefaultConfig().performance.thresholds
        },
        errorHandling: { 
          enableErrorEnrichment: false,
          enableContextualSuggestions: false,
          logLevel: 'error' as const,
          maxErrorHistory: 20,
          enablePerformanceErrorDetection: false
        },
        features: { 
          enableParallelAnalysis: false,
          enableSmartHandleManagement: false,
          enableAdvancedElementDiscovery: false,
          enableResourceLeakDetection: false,
          enableRealTimeMonitoring: false 
        }
      }
    };

    this.updateConfig(envConfigs[env]);
  }

  // Get component-specific configuration
  getComponentConfig(component: 'pageAnalyzer' | 'elementDiscovery' | 'resourceManager'): any {
    const base = {
      diagnostic: this.config.diagnostic,
      performance: this.config.performance,
      errorHandling: this.config.errorHandling
    };

    switch (component) {
      case 'pageAnalyzer':
        return {
          ...base,
          executionTimeout: this.config.performance.thresholds.executionTime.pageAnalysis,
          enableParallel: this.config.features.enableParallelAnalysis,
          enableResourceMonitoring: this.config.features.enableResourceLeakDetection
        };
        
      case 'elementDiscovery':
        return {
          ...base,
          executionTimeout: this.config.performance.thresholds.executionTime.elementDiscovery,
          maxAlternatives: this.config.diagnostic.maxAlternatives,
          enableAdvanced: this.config.features.enableAdvancedElementDiscovery
        };
        
      case 'resourceManager':
        return {
          ...base,
          executionTimeout: this.config.performance.thresholds.executionTime.resourceMonitoring,
          autoDisposeTimeout: this.config.autoDisposeTimeout,
          maxHandles: this.config.maxConcurrentHandles,
          enableLeakDetection: this.config.features.enableResourceLeakDetection
        };
        
      default:
        return base;
    }
  }

  // Export configuration for debugging
  exportConfig(): string {
    return JSON.stringify(this.config, null, 2);
  }

  // Reset to defaults
  reset(): void {
    const previousConfig = { ...this.config };
    this.config = this.createDefaultConfig();
    this.notifyListeners();
    
    console.info('[SmartConfig] Configuration reset to defaults');
  }
}