/**
 * Unified configuration system for all diagnostic components
 */

import { DiagnosticLevel  } from './DiagnosticLevel.js';
import { MetricsThresholds } from '../types/performance.js';
import { DiagnosticThresholds  } from './DiagnosticThresholds.js';
import type { DiagnosticConfig } from './DiagnosticLevel.js';
import type { DiagnosticThresholdsConfig } from './DiagnosticThresholds.js';

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
  private thresholdsManager: DiagnosticThresholds;

  private constructor(initialConfig?: Partial<SmartConfig>) {
    this.config = this.createDefaultConfig();
    // Initialize integrated threshold management system
    this.thresholdsManager = DiagnosticThresholds.getInstance();
    if (initialConfig)
      this.updateConfig(initialConfig);

  }

  static getInstance(initialConfig?: Partial<SmartConfig>): SmartConfigManager {
    if (!SmartConfigManager.instance)
      SmartConfigManager.instance = new SmartConfigManager(initialConfig);

    return SmartConfigManager.instance;
  }

  private createDefaultConfig(): SmartConfig {
    // Get thresholds from DiagnosticThresholds (eliminate hardcoding)
    const defaultThresholds = DiagnosticThresholds.getInstance().getMetricsThresholds();

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
        thresholds: defaultThresholds
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

    // If thresholds are updated, sync DiagnosticThresholds as well
    if (updates.performance?.thresholds)
      this.syncThresholdsWithManager(updates.performance.thresholds);


    this.notifyListeners();

  }

  private deepMerge(target: any, source: any): any {
    if (source === null || typeof source !== 'object')
      return source;


    if (Array.isArray(source))
      return [...source];


    const result = { ...target };

    for (const key in source) {
      if (source.hasOwnProperty(key)) {
        if (typeof source[key] === 'object' && !Array.isArray(source[key]))
          result[key] = this.deepMerge(target[key] || {}, source[key]);
        else
          result[key] = source[key];

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
      if (prevValue !== currentValue)
        diff[key] = { from: prevValue, to: currentValue };

    });

    return diff;
  }

  onConfigChange(listener: (config: SmartConfig) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1)
        this.listeners.splice(index, 1);

    };
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener(this.config);
      } catch (error) {
        // Silently ignore listener errors
      }
    });
  }

  // Adaptive threshold management
  adjustThresholds(component: 'pageAnalysis' | 'elementDiscovery' | 'resourceMonitoring',
    avgExecutionTime: number, successRate: number): void {
    if (!this.config.runtime.enableAdaptiveThresholds)
      return;


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
    // DiagnosticThresholdsもリセット
    this.thresholdsManager.resetToDefaults();
    this.notifyListeners();
  }

  /**
   * DiagnosticThresholds との同期（閾値管理統合）
   */
  private syncThresholdsWithManager(thresholds: MetricsThresholds): void {
    try {
      // MetricsThresholds を DiagnosticThresholdsConfig 形式に変換
      const thresholdsConfig: DiagnosticThresholdsConfig = {
        executionTime: thresholds.executionTime,
        memory: thresholds.memory,
        performance: thresholds.performance,
        dom: thresholds.dom,
        interaction: thresholds.interaction,
        layout: thresholds.layout
      };

      // DiagnosticThresholds を更新
      this.thresholdsManager.updateThresholds(thresholdsConfig);
    } catch (error) {
      // Silently ignore sync errors
    }
  }

  /**
   * DiagnosticThresholds から最新の閾値を取得
   */
  getThresholdsFromManager(): MetricsThresholds {
    return this.thresholdsManager.getMetricsThresholds();
  }

  /**
   * 閾値設定の統合状態を取得
   */
  getThresholdsStatus(): {
    isInSync: boolean;
    diagnostics: {
      status: 'valid' | 'invalid';
      customizations: string[];
      warnings: string[];
      defaultsUsed: string[];
    };
    smartConfigStatus: string;
    } {
    const managerThresholds = this.thresholdsManager.getMetricsThresholds();
    const configThresholds = this.config.performance.thresholds;

    // 同期状態をチェック
    const isInSync = JSON.stringify(managerThresholds) === JSON.stringify(configThresholds);

    return {
      isInSync,
      diagnostics: this.thresholdsManager.getConfigDiagnostics(),
      smartConfigStatus: isInSync
        ? 'Synchronized with DiagnosticThresholds'
        : 'Out of sync - manual update required'
    };
  }

  /**
   * 環境別設定で閾値管理を統合
   */
  configureForEnvironment(env: 'development' | 'production' | 'testing'): void {
    // 既存の設定適用
    const envConfigs = {
      development: {
        diagnostic: { level: DiagnosticLevel.FULL },
        performance: {
          enableMetricsCollection: true,
          enableResourceMonitoring: true,
          enablePerformanceWarnings: true,
          autoOptimization: true,
          thresholds: this.thresholdsManager.getMetricsThresholds()  // 統合された閾値使用
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
          thresholds: this.thresholdsManager.getMetricsThresholds()  // 統合された閾値使用
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
          thresholds: this.thresholdsManager.getMetricsThresholds()  // 統合された閾値使用
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

  /**
   * 閾値のみを更新（DiagnosticThresholds 経由）
   */
  updateThresholds(thresholdsConfig: DiagnosticThresholdsConfig): void {
    try {
      // DiagnosticThresholds を更新
      this.thresholdsManager.updateThresholds(thresholdsConfig);

      // SmartConfig の閾値も同期更新
      const updatedThresholds = this.thresholdsManager.getMetricsThresholds();
      this.updateConfig({
        performance: {
          ...this.config.performance,
          thresholds: updatedThresholds
        }
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * 設定変更の影響を詳細にレポートする
   */
  getConfigurationImpactReport(): {
    activeOverrides: string[];
    performanceImpact: {
      executionTimeChanges: Record<string, { from: number; to: number; percentChange: number }>;
      memoryImpact: string;
      recommendedOptimizations: string[];
    };
    featureChanges: {
      enabled: string[];
      disabled: string[];
      modified: string[];
    };
    validationStatus: {
      isValid: boolean;
      warnings: string[];
      errors: string[];
    };
    } {
    // デフォルト設定と現在の設定を比較
    const defaultConfig = this.createDefaultConfig();
    const currentConfig = this.getConfig();

    const activeOverrides: string[] = [];
    const executionTimeChanges: Record<string, { from: number; to: number; percentChange: number }> = {};
    const enabled: string[] = [];
    const disabled: string[] = [];
    const modified: string[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    // パフォーマンス閾値の変更をチェック
    const defaultThresholds = defaultConfig.performance.thresholds.executionTime;
    const currentThresholds = currentConfig.performance.thresholds.executionTime;

    Object.keys(defaultThresholds).forEach(key => {
      const componentKey = key as keyof typeof defaultThresholds;
      const defaultValue = defaultThresholds[componentKey];
      const currentValue = currentThresholds[componentKey];

      if (defaultValue !== currentValue) {
        const percentChange = ((currentValue - defaultValue) / defaultValue) * 100;
        executionTimeChanges[key] = {
          from: defaultValue,
          to: currentValue,
          percentChange: Math.round(percentChange)
        };
        activeOverrides.push(`${key} threshold: ${defaultValue}ms → ${currentValue}ms (${percentChange > 0 ? '+' : ''}${percentChange.toFixed(1)}%)`);
      }
    });

    // 機能フラグの変更をチェック
    const featureChecks = [
      { key: 'enableParallelAnalysis', name: 'Parallel Analysis' },
      { key: 'enableSmartHandleManagement', name: 'Smart Handle Management' },
      { key: 'enableAdvancedElementDiscovery', name: 'Advanced Element Discovery' },
      { key: 'enableResourceLeakDetection', name: 'Resource Leak Detection' },
      { key: 'enableRealTimeMonitoring', name: 'Real-Time Monitoring' }
    ];

    featureChecks.forEach(({ key, name }) => {
      const featureKey = key as keyof typeof defaultConfig.features;
      const defaultValue = defaultConfig.features[featureKey];
      const currentValue = currentConfig.features[featureKey];

      if (defaultValue !== currentValue) {
        if (currentValue && !defaultValue) {
          enabled.push(name);
          activeOverrides.push(`${name}: Enabled (was disabled by default)`);
        } else if (!currentValue && defaultValue) {
          disabled.push(name);
          activeOverrides.push(`${name}: Disabled (was enabled by default)`);
        }
      }
    });

    // エラーハンドリング設定の変更をチェック
    if (defaultConfig.errorHandling.enableErrorEnrichment !== currentConfig.errorHandling.enableErrorEnrichment) {
      const status = currentConfig.errorHandling.enableErrorEnrichment ? 'Enabled' : 'Disabled';
      modified.push(`Error Enrichment: ${status}`);
      activeOverrides.push(`Error Enrichment: ${status}`);
    }

    // 診断レベルの変更をチェック
    if (defaultConfig.diagnostic.level !== currentConfig.diagnostic.level) {
      modified.push(`Diagnostic Level: ${defaultConfig.diagnostic.level} → ${currentConfig.diagnostic.level}`);
      activeOverrides.push(`Diagnostic Level: ${defaultConfig.diagnostic.level} → ${currentConfig.diagnostic.level}`);
    }

    // バリデーション
    const isValid = errors.length === 0;

    // パフォーマンス影響の評価
    let memoryImpact = 'Minimal';
    const recommendedOptimizations: string[] = [];

    if (currentConfig.features.enableResourceLeakDetection && !defaultConfig.features.enableResourceLeakDetection) {
      memoryImpact = 'Low - Resource monitoring adds overhead';
      recommendedOptimizations.push('Consider disabling in production if not needed');
    }

    if (currentConfig.features.enableRealTimeMonitoring) {
      memoryImpact = 'Medium - Real-time monitoring requires continuous data collection';
      recommendedOptimizations.push('Only enable for debugging sessions');
    }

    // パフォーマンス警告の生成
    Object.entries(executionTimeChanges).forEach(([component, change]) => {
      if (change.percentChange > 50)
        warnings.push(`${component} timeout increased significantly (+${change.percentChange}%) - may mask performance issues`);
      else if (change.percentChange < -30)
        warnings.push(`${component} timeout decreased significantly (${change.percentChange}%) - may cause false failures`);

    });

    if (enabled.length > 3)
      warnings.push(`Many features enabled (${enabled.length}) - consider selective enablement for better performance`);


    return {
      activeOverrides,
      performanceImpact: {
        executionTimeChanges,
        memoryImpact,
        recommendedOptimizations
      },
      featureChanges: {
        enabled,
        disabled,
        modified
      },
      validationStatus: {
        isValid,
        warnings,
        errors
      }
    };
  }

  /**
   * 設定変更のサマリーを取得
   */
  getConfigurationSummary(): {
    totalOverrides: number;
    significantChanges: number;
    performanceRisk: 'low' | 'medium' | 'high';
    recommendation: string;
    } {
    const impactReport = this.getConfigurationImpactReport();
    const totalOverrides = impactReport.activeOverrides.length;
    const significantChanges = impactReport.featureChanges.enabled.length +
                              impactReport.featureChanges.disabled.length +
                              Object.keys(impactReport.performanceImpact.executionTimeChanges).length;

    // パフォーマンスリスクの評価
    let performanceRisk: 'low' | 'medium' | 'high' = 'low';

    if (impactReport.validationStatus.errors.length > 0)
      performanceRisk = 'high';
    else if (impactReport.validationStatus.warnings.length > 2 || significantChanges > 5)
      performanceRisk = 'medium';


    // 推奨事項の生成
    let recommendation = 'Configuration is optimal';

    if (performanceRisk === 'high')
      recommendation = 'Review and fix configuration errors before proceeding';
    else if (performanceRisk === 'medium')
      recommendation = 'Consider reviewing warnings and optimizing configuration';
    else if (totalOverrides === 0)
      recommendation = 'Using default configuration - consider customization for your use case';


    return {
      totalOverrides,
      significantChanges,
      performanceRisk,
      recommendation
    };
  }
}
