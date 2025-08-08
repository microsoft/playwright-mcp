/**
 * Handles configuration management for the diagnose tool
 */

import { getCurrentThresholds } from '../../diagnostics/diagnostic-thresholds.js';
import { PageAnalyzer } from '../../diagnostics/page-analyzer.js';
import type { SmartConfig } from '../../diagnostics/smart-config.js';
import { UnifiedDiagnosticSystem } from '../../diagnostics/unified-system.js';
import type { Tab } from '../../tab.js';

export interface ConfigOverrides {
  enableResourceMonitoring?: boolean;
  enableErrorEnrichment?: boolean;
  enableAdaptiveThresholds?: boolean;
  performanceThresholds?: {
    pageAnalysis?: number;
    elementDiscovery?: number;
    resourceMonitoring?: number;
  };
}

export interface DiagnoseSystemConfig {
  unifiedSystem?: UnifiedDiagnosticSystem;
  pageAnalyzer?: PageAnalyzer;
  appliedOverrides: string[];
}

export class DiagnoseConfigHandler {
  validateConfiguration(): {
    status: string;
    warnings: string[];
    customizations: string[];
  } {
    try {
      const thresholdsManager = getCurrentThresholds();
      return thresholdsManager.getConfigDiagnostics();
    } catch (error) {
      console.warn('Configuration validation failed:', error);
      return {
        status: 'failed',
        warnings: [
          'Configuration system validation failed - using fallback settings',
        ],
        customizations: [],
      };
    }
  }

  initializeSystems(
    tab: Tab,
    useUnifiedSystem: boolean,
    _useParallelAnalysis: boolean,
    configOverrides?: ConfigOverrides
  ): DiagnoseSystemConfig {
    const appliedOverrides: string[] = [];

    if (useUnifiedSystem) {
      const configUpdates = this.buildConfigUpdates(
        configOverrides,
        appliedOverrides
      );
      const unifiedSystem = UnifiedDiagnosticSystem.getInstance(
        tab.page,
        configUpdates
      );

      return {
        unifiedSystem,
        appliedOverrides,
      };
    }
    const pageAnalyzer = new PageAnalyzer(tab.page);
    return {
      pageAnalyzer,
      appliedOverrides,
    };
  }

  private buildConfigUpdates(
    configOverrides?: ConfigOverrides,
    appliedOverrides: string[] = []
  ): Partial<SmartConfig> {
    const configUpdates: Partial<SmartConfig> = {};

    if (!configOverrides) {
      return configUpdates;
    }

    if (configOverrides.enableResourceMonitoring !== undefined) {
      configUpdates.features = {
        enableParallelAnalysis: true,
        enableSmartHandleManagement: true,
        enableAdvancedElementDiscovery: true,
        enableResourceLeakDetection: configOverrides.enableResourceMonitoring,
        enableRealTimeMonitoring: false,
      };
      appliedOverrides.push(
        `Resource Monitoring: ${configOverrides.enableResourceMonitoring ? 'Enabled' : 'Disabled'}`
      );
    }

    if (configOverrides.enableErrorEnrichment !== undefined) {
      configUpdates.errorHandling = {
        enableErrorEnrichment: configOverrides.enableErrorEnrichment,
        enableContextualSuggestions: true,
        logLevel: 'warn' as const,
        maxErrorHistory: 100,
        enablePerformanceErrorDetection: true,
      };
      appliedOverrides.push(
        `Error Enrichment: ${configOverrides.enableErrorEnrichment ? 'Enabled' : 'Disabled'}`
      );
    }

    if (configOverrides.enableAdaptiveThresholds !== undefined) {
      configUpdates.runtime = {
        enableAdaptiveThresholds: configOverrides.enableAdaptiveThresholds,
        enableAutoTuning: false,
        statsCollectionEnabled: true,
      };
      appliedOverrides.push(
        `Adaptive Thresholds: ${configOverrides.enableAdaptiveThresholds ? 'Enabled' : 'Disabled'}`
      );
    }

    if (configOverrides.performanceThresholds) {
      this.applyPerformanceThresholds(
        configUpdates,
        configOverrides.performanceThresholds,
        appliedOverrides
      );
    }

    return configUpdates;
  }

  private applyPerformanceThresholds(
    configUpdates: Partial<SmartConfig>,
    performanceThresholds: NonNullable<
      ConfigOverrides['performanceThresholds']
    >,
    appliedOverrides: string[]
  ): void {
    const baseThresholds = getCurrentThresholds().getMetricsThresholds();
    const customThresholds = { ...baseThresholds };
    const thresholdChanges: string[] = [];

    if (performanceThresholds.pageAnalysis) {
      const oldValue = customThresholds.executionTime.pageAnalysis;
      customThresholds.executionTime.pageAnalysis =
        performanceThresholds.pageAnalysis;
      thresholdChanges.push(
        `Page Analysis: ${oldValue}ms → ${performanceThresholds.pageAnalysis}ms`
      );
    }

    if (performanceThresholds.elementDiscovery) {
      const oldValue = customThresholds.executionTime.elementDiscovery;
      customThresholds.executionTime.elementDiscovery =
        performanceThresholds.elementDiscovery;
      thresholdChanges.push(
        `Element Discovery: ${oldValue}ms → ${performanceThresholds.elementDiscovery}ms`
      );
    }

    if (performanceThresholds.resourceMonitoring) {
      const oldValue = customThresholds.executionTime.resourceMonitoring;
      customThresholds.executionTime.resourceMonitoring =
        performanceThresholds.resourceMonitoring;
      thresholdChanges.push(
        `Resource Monitoring: ${oldValue}ms → ${performanceThresholds.resourceMonitoring}ms`
      );
    }

    if (thresholdChanges.length > 0) {
      appliedOverrides.push(
        `Performance Thresholds: ${thresholdChanges.join(', ')}`
      );
      configUpdates.performance = {
        enableMetricsCollection: true,
        enableResourceMonitoring: true,
        enablePerformanceWarnings: true,
        autoOptimization: true,
        thresholds: customThresholds,
      };
    }
  }
}
