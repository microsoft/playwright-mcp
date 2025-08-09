/**
 * Unified diagnostic system that integrates all components
 */

import type * as playwright from 'playwright';
import { getErrorMessage } from '../utils/common-formatters.js';
import { createDiagnosticLogger } from './common/diagnostic-base.js';
import {
  createAdvancedStage,
  createCoreStage,
  createDependentStage,
  InitializationManager,
} from './common/initialization-manager.js';
import { PerformanceTracker } from './common/performance-tracker.js';
import type { DiagnosticComponent } from './diagnostic-error.js';
import { DiagnosticError } from './diagnostic-error.js';
import { ElementDiscovery } from './element-discovery.js';
import { EnhancedErrorHandler } from './enhanced-error-handler.js';
import { PageAnalyzer } from './page-analyzer.js';
import { ParallelPageAnalyzer } from './parallel-page-analyzer.js';
import { ResourceManager } from './resource-manager.js';
import type { SmartConfig } from './smart-config.js';
import { SmartConfigManager } from './smart-config.js';

// Type aliases for reducing duplication
export type SignificanceLevel = 'normal' | 'notable' | 'significant';
export type PriorityLevel = 'low' | 'medium' | 'high';
export type RecommendationType = 'optimization' | 'warning' | 'info';
export type HealthStatus = 'healthy' | 'warning' | 'critical';

// Configuration report type aliases
type ConfigurationStatus = 'default' | 'customized' | 'heavily-customized';
type AppliedOverride = {
  category: string;
  changes: string[];
  impact: PriorityLevel;
};
type PerformanceBaseline = {
  expectedExecutionTimes: Record<string, number>;
  actualAverages: Record<string, number>;
  deviations: Record<
    string,
    { percent: number; significance: SignificanceLevel }
  >;
};
type Recommendation = {
  type: RecommendationType;
  message: string;
  priority: PriorityLevel;
};

export interface SystemStats {
  operationCount: Record<string, number>;
  errorCount: Record<DiagnosticComponent, number>;
  performanceMetrics: {
    averageExecutionTime: Record<string, number>;
    peakMemoryUsage: number;
    totalOperations: number;
    successRate: number;
  };
  resourceUsage: {
    currentHandles: number;
    peakHandles: number;
    memoryLeaks: number;
    autoDisposeCount: number;
  };
}

export interface OperationResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: DiagnosticError;
  executionTime: number;
}

export class UnifiedDiagnosticSystem {
  private static readonly instances = new Map<
    playwright.Page,
    UnifiedDiagnosticSystem
  >();

  private readonly page: playwright.Page;
  private readonly configManager: SmartConfigManager;
  private readonly initializationManager: InitializationManager;
  private readonly performanceTracker: PerformanceTracker;
  private readonly logger: ReturnType<typeof createDiagnosticLogger>;

  private pageAnalyzer?: PageAnalyzer;
  private parallelAnalyzer?: ParallelPageAnalyzer;
  private elementDiscovery?: ElementDiscovery;
  private resourceManager?: ResourceManager;
  private errorHandler?: EnhancedErrorHandler;

  private readonly stats: SystemStats;
  private operationHistory: Array<{
    operation: string;
    component: DiagnosticComponent;
    timestamp: number;
    executionTime: number;
    success: boolean;
  }> = [];

  private constructor(page: playwright.Page, config?: Partial<SmartConfig>) {
    this.page = page;
    this.configManager = SmartConfigManager.getInstance(config);
    this.performanceTracker = new PerformanceTracker();
    this.logger = createDiagnosticLogger('UnifiedSystem', 'system');

    this.initializationManager = new InitializationManager({
      componentName: 'UnifiedSystem',
      config,
      performanceTracker: this.performanceTracker,
    });

    // Initialize basic stats and listener setup
    this.stats = this.initializeStats();
    this.setupConfigurationListener();
  }

  /**
   * Initialize all diagnostic components using common initialization manager
   */
  async initializeComponents(): Promise<void> {
    const stages = [
      createCoreStage('core-infrastructure', [
        () => {
          this.resourceManager = new ResourceManager();
          this.initializationManager.trackPartialInitialization(
            this.resourceManager
          );
          return Promise.resolve();
        },
      ]),
      createDependentStage(
        'page-dependent',
        ['core-infrastructure'],
        [
          () => {
            const componentConfig =
              this.configManager.getComponentConfig('pageAnalyzer');
            this.pageAnalyzer = new PageAnalyzer(this.page);
            this.elementDiscovery = new ElementDiscovery(this.page);
            this.errorHandler = new EnhancedErrorHandler(
              this.page,
              // biome-ignore lint/suspicious/noExplicitAny: Component config requires dynamic type handling
              componentConfig.diagnostic as any
            );

            this.initializationManager.trackPartialInitialization(
              this.pageAnalyzer
            );
            this.initializationManager.trackPartialInitialization(
              this.elementDiscovery
            );
            return Promise.resolve();
          },
        ]
      ),
      createAdvancedStage('advanced-features', [
        () => {
          this.parallelAnalyzer = new ParallelPageAnalyzer(this.page);
          this.initializationManager.trackPartialInitialization(
            this.parallelAnalyzer
          );
          return Promise.resolve();
        },
      ]),
    ];

    await this.initializationManager.initialize(stages);
  }

  /**
   * Ensure components are initialized before performing operations
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initializationManager.getIsInitialized()) {
      await this.initializeComponents();
    }

    if (!this.initializationManager.getIsInitialized()) {
      const error = this.initializationManager.getInitializationError();
      throw (
        error ||
        new DiagnosticError('UnifiedSystem components are not initialized', {
          timestamp: Date.now(),
          component: 'UnifiedSystem',
          operation: 'ensureInitialized',
          suggestions: [
            'Call initializeComponents() before using the system',
            'Check for initialization errors',
            'Verify page and configuration are valid',
          ],
        })
      );
    }
  }

  static getInstance(
    page: playwright.Page,
    config?: Partial<SmartConfig>
  ): UnifiedDiagnosticSystem {
    if (!UnifiedDiagnosticSystem.instances.has(page)) {
      const instance = new UnifiedDiagnosticSystem(page, config);
      UnifiedDiagnosticSystem.instances.set(page, instance);
      // Initialize components asynchronously without blocking getInstance
      instance.initializeComponents().catch((_error) => {
        // Initialization errors will be caught when methods are called
      });
    }
    const system = UnifiedDiagnosticSystem.instances.get(page);
    if (!system) {
      throw new Error('UnifiedDiagnosticSystem instance not found');
    }
    return system;
  }

  static disposeInstance(page: playwright.Page): void {
    const instance = UnifiedDiagnosticSystem.instances.get(page);
    if (instance) {
      instance.dispose();
      UnifiedDiagnosticSystem.instances.delete(page);
    }
  }

  private initializeStats(): SystemStats {
    return {
      operationCount: {},
      errorCount: {
        PageAnalyzer: 0,
        ElementDiscovery: 0,
        ResourceManager: 0,
        ErrorHandler: 0,
        ConfigManager: 0,
        UnifiedSystem: 0,
      },
      performanceMetrics: {
        averageExecutionTime: {},
        peakMemoryUsage: 0,
        totalOperations: 0,
        successRate: 1.0,
      },
      resourceUsage: {
        currentHandles: 0,
        peakHandles: 0,
        memoryLeaks: 0,
        autoDisposeCount: 0,
      },
    };
  }

  private setupConfigurationListener(): void {
    this.configManager.onConfigChange((_config) => {
      this.logger.info('Configuration updated', { hasChanges: true });
    });
  }

  // Unified operation wrapper with enhanced error handling and monitoring
  async executeOperation<T>(
    operation: string,
    component: DiagnosticComponent,
    fn: () => Promise<T>,
    options?: { timeout?: number; enableResourceMonitoring?: boolean }
  ): Promise<OperationResult<T>> {
    const startTime = Date.now();
    const config = this.configManager.getConfig();
    let componentConfigType:
      | 'pageAnalyzer'
      | 'elementDiscovery'
      | 'resourceManager';
    switch (component) {
      case 'ElementDiscovery':
        componentConfigType = 'elementDiscovery';
        break;
      case 'ResourceManager':
        componentConfigType = 'resourceManager';
        break;
      default:
        componentConfigType = 'pageAnalyzer';
    }
    const componentConfig =
      this.configManager.getComponentConfig(componentConfigType);

    try {
      // Apply timeout if specified
      const timeout = Number(
        options?.timeout ?? componentConfig.executionTimeout ?? 10_000
      );
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(
          () => reject(new Error(`Operation timeout after ${timeout}ms`)),
          timeout
        );
        // timeoutId is available for cleanup if needed
      });

      const result = await Promise.race([fn(), timeoutPromise]);
      const executionTime = Date.now() - startTime;

      // Record successful operation
      this.recordOperation(operation, component, executionTime, true);

      return {
        success: true,
        data: result,
        executionTime,
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;

      // Record failed operation
      this.recordOperation(operation, component, executionTime, false);
      this.stats.errorCount[component]++;

      // Create enhanced diagnostic error
      let enhancedDiagnosticError: DiagnosticError;
      if (error instanceof DiagnosticError) {
        enhancedDiagnosticError = error;
      } else {
        const baseError =
          error instanceof Error ? error : new Error(getErrorMessage(error));
        this.logger.error('Operation failed', {
          operation,
          component,
          executionTime,
          error: baseError.message,
        });
        enhancedDiagnosticError = DiagnosticError.from(
          baseError,
          component,
          operation,
          {
            executionTime,
            timestamp: startTime,
          }
        );
      }

      // Apply error enrichment if enabled
      let enrichedError = enhancedDiagnosticError;
      if (config.errorHandling.enableErrorEnrichment) {
        try {
          enrichedError = await this.enrichError(
            enhancedDiagnosticError,
            operation
          );
        } catch (_enrichmentError) {
          this.logger.warn('Error enrichment failed', {
            operation,
            originalError: enhancedDiagnosticError.message,
            enrichmentError: getErrorMessage(_enrichmentError),
          });
        }
      }

      return {
        success: false,
        error: enrichedError,
        executionTime,
      };
    }
  }

  private recordOperation(
    operation: string,
    component: DiagnosticComponent,
    executionTime: number,
    success: boolean
  ): void {
    this.updateOperationStats(operation, executionTime, success);
    this.updateOperationHistory(operation, component, executionTime, success);
    this.performAdaptiveThresholdAdjustment(operation, component);
  }

  private updateOperationStats(
    operation: string,
    executionTime: number,
    success: boolean
  ): void {
    // Update operation count
    this.stats.operationCount[operation] =
      (this.stats.operationCount[operation] ?? 0) + 1;

    // Update performance metrics
    const currentAvg =
      this.stats.performanceMetrics.averageExecutionTime[operation] ?? 0;
    const currentCount = this.stats.operationCount[operation];
    this.stats.performanceMetrics.averageExecutionTime[operation] =
      (currentAvg * (currentCount - 1) + executionTime) / currentCount;

    this.stats.performanceMetrics.totalOperations++;

    // Update success rate
    const successfulOps =
      this.operationHistory.filter((op) => op.success).length +
      (success ? 1 : 0);
    const totalOps = this.operationHistory.length + 1;
    this.stats.performanceMetrics.successRate = successfulOps / totalOps;
  }

  private updateOperationHistory(
    operation: string,
    component: DiagnosticComponent,
    executionTime: number,
    success: boolean
  ): void {
    // Add to operation history (maintain limited size)
    this.operationHistory.push({
      operation,
      component,
      timestamp: Date.now(),
      executionTime,
      success,
    });

    const maxHistory =
      this.configManager.getConfig().errorHandling.maxErrorHistory;
    if (this.operationHistory.length > maxHistory) {
      this.operationHistory = this.operationHistory.slice(-maxHistory);
    }
  }

  private performAdaptiveThresholdAdjustment(
    operation: string,
    component: DiagnosticComponent
  ): void {
    // Use centralized configuration check to eliminate duplication
    if (!this.configManager.isAdaptiveThresholdsEnabled()) {
      return;
    }

    const recentOps = this.operationHistory.filter(
      (op) => op.operation === operation && Date.now() - op.timestamp < 300_000 // Last 5 minutes
    );

    if (recentOps.length >= 10) {
      // Enough data for adjustment
      const avgTime =
        recentOps.reduce((sum, op) => sum + op.executionTime, 0) /
        recentOps.length;
      const successRate =
        recentOps.filter((op) => op.success).length / recentOps.length;

      this.adjustComponentThresholds(component, avgTime, successRate);
    }
  }

  private adjustComponentThresholds(
    component: DiagnosticComponent,
    avgTime: number,
    successRate: number
  ): void {
    if (component === 'PageAnalyzer') {
      this.configManager.adjustThresholds('pageAnalysis', avgTime, successRate);
    } else if (component === 'ElementDiscovery') {
      this.configManager.adjustThresholds(
        'elementDiscovery',
        avgTime,
        successRate
      );
    } else if (component === 'ResourceManager') {
      this.configManager.adjustThresholds(
        'resourceMonitoring',
        avgTime,
        successRate
      );
    }
  }

  private async enrichError(
    error: DiagnosticError,
    operation: string
  ): Promise<DiagnosticError> {
    try {
      if (!this.errorHandler) {
        return error; // Return original error if handler is not initialized
      }

      // Use the enhanced error handler for context-aware enrichment
      const enrichedPlaywrightError = await this.errorHandler.enhanceToolError({
        toolName: operation,
        error: new Error(error.message),
        toolArgs: { component: error.component, operation: error.operation },
      });

      // Create a new DiagnosticError with enriched information
      const enrichedDiagnosticError = new DiagnosticError(
        enrichedPlaywrightError.message,
        {
          timestamp: error.timestamp,
          component: error.component,
          operation: error.operation,
          executionTime: error.executionTime,
          performanceImpact: error.performanceImpact,
          suggestions: [
            ...error.suggestions,
            ...(enrichedPlaywrightError.suggestions ?? []),
          ],
        },
        error.originalError
      );

      return enrichedDiagnosticError;
    } catch (_enrichmentError) {
      this.logger.warn('Error enrichment process failed', {
        operation,
        originalError: error.message,
        enrichmentError: getErrorMessage(_enrichmentError),
      });
      return error;
    }
  }

  // High-level API methods that use the unified operation wrapper
  async analyzePageStructure(
    forceParallel?: boolean
  ): Promise<OperationResult> {
    await this.ensureInitialized();
    const config = this.configManager.getConfig();

    // Determine analysis mode with clear logging
    const shouldUseParallel =
      forceParallel ?? config.features.enableParallelAnalysis;

    if (shouldUseParallel) {
      return this.executeOperation(
        'analyzePageStructure',
        'PageAnalyzer',
        async () => {
          const recommendation =
            await this.pageAnalyzer?.shouldUseParallelAnalysis();

          if (recommendation?.recommended ?? forceParallel) {
            return await this.parallelAnalyzer?.runParallelAnalysis();
          }
          return await this.pageAnalyzer?.analyzePageStructure();
        }
      );
    }
    return this.executeOperation(
      'analyzePageStructure',
      'PageAnalyzer',
      async () => this.pageAnalyzer?.analyzePageStructure()
    );
  }

  async findAlternativeElements(searchCriteria: {
    text?: string;
    role?: string;
    tagName?: string;
    attributes?: Record<string, string>;
  }): Promise<OperationResult> {
    await this.ensureInitialized();
    return this.executeOperation(
      'findAlternativeElements',
      'ElementDiscovery',
      async () =>
        this.elementDiscovery?.findAlternativeElements({
          originalSelector: '',
          searchCriteria,
          maxResults: 10,
        })
    );
  }

  async analyzePerformanceMetrics(): Promise<OperationResult> {
    await this.ensureInitialized();
    return this.executeOperation(
      'analyzePerformanceMetrics',
      'PageAnalyzer',
      async () => this.pageAnalyzer?.analyzePerformanceMetrics()
    );
  }

  // Resource management with automatic cleanup
  async createSmartHandle<T>(
    creator: () => Promise<T>,
    _disposer: (handle: T) => Promise<void>,
    _options?: { timeout?: number; category?: string }
  ): Promise<T> {
    await this.ensureInitialized();
    const handle = await creator();
    const smartHandle = this.resourceManager?.createSmartHandle(
      handle as Record<string, unknown>,
      'dispose'
    );
    return (smartHandle?.handle as T) ?? handle;
  }

  // Configuration management
  updateConfiguration(updates: Partial<SmartConfig>): void {
    this.configManager.updateConfig(updates);
  }

  getConfiguration(): SmartConfig {
    return this.configManager.getConfig();
  }

  // System monitoring and statistics
  getSystemStats(): SystemStats {
    if (
      !(this.initializationManager.getIsInitialized() && this.resourceManager)
    ) {
      return this.stats;
    }

    const currentResourceUsage = this.resourceManager.getResourceStats();

    return {
      ...this.stats,
      resourceUsage: {
        ...this.stats.resourceUsage,
        currentHandles: currentResourceUsage.activeCount,
        peakHandles: Math.max(
          this.stats.resourceUsage.peakHandles ?? 0,
          currentResourceUsage.activeCount
        ),
      },
    };
  }

  getRecentOperations(limit = 50): Array<{
    operation: string;
    component: DiagnosticComponent;
    timestamp: number;
    executionTime: number;
    success: boolean;
  }> {
    return this.operationHistory.slice(-limit);
  }

  getConfigurationReport(): {
    configurationStatus: ConfigurationStatus;
    appliedOverrides: AppliedOverride[];
    performanceBaseline: PerformanceBaseline;
    recommendations: Recommendation[];
  } {
    const configData = this.getConfigData();
    const configurationStatus = this.determineConfigurationStatus(
      configData.configSummary
    );
    const appliedOverrides = this.buildAppliedOverrides(
      configData.impactReport
    );
    const performanceBaseline = this.calculatePerformanceBaseline(
      configData.config
    );
    const recommendations = this.generateAllRecommendations(
      configData.impactReport,
      performanceBaseline.deviations
    );

    return {
      configurationStatus,
      appliedOverrides,
      performanceBaseline,
      recommendations: this.sortRecommendations(recommendations),
    };
  }

  private getConfigData() {
    const config = this.configManager.getConfig();
    const impactReport = this.configManager.getConfigurationImpactReport();
    const configSummary = this.configManager.getConfigurationSummary();
    return { config, impactReport, configSummary };
  }

  private determineConfigurationStatus(configSummary: {
    totalOverrides: number;
  }): ConfigurationStatus {
    if (configSummary.totalOverrides === 0) {
      return 'default';
    }
    return configSummary.totalOverrides > 5
      ? 'heavily-customized'
      : 'customized';
  }

  private buildAppliedOverrides(impactReport: {
    performanceImpact: {
      executionTimeChanges: Record<
        string,
        { from: number; to: number; percentChange: number }
      >;
    };
    featureChanges: {
      enabled: string[];
      disabled: string[];
      modified: string[];
    };
  }) {
    return [
      {
        category: 'Performance Thresholds',
        changes: Object.entries(
          impactReport.performanceImpact.executionTimeChanges
        ).map(
          ([component, change]: [
            string,
            { from: number; to: number; percentChange: number },
          ]) =>
            `${component}: ${change.from}ms → ${change.to}ms (${change.percentChange > 0 ? '+' : ''}${change.percentChange}%)`
        ),
        impact:
          Object.keys(impactReport.performanceImpact.executionTimeChanges)
            .length > 2
            ? ('high' as const)
            : ('medium' as const),
      },
      {
        category: 'Feature Flags',
        changes: [
          ...impactReport.featureChanges.enabled.map(
            (feature: string) => `${feature}: Enabled`
          ),
          ...impactReport.featureChanges.disabled.map(
            (feature: string) => `${feature}: Disabled`
          ),
          ...impactReport.featureChanges.modified,
        ],
        impact:
          impactReport.featureChanges.enabled.length +
            impactReport.featureChanges.disabled.length >
          2
            ? ('medium' as const)
            : ('low' as const),
      },
    ].filter((override) => override.changes.length > 0);
  }

  private calculatePerformanceBaseline(config: {
    performance: {
      thresholds: {
        executionTime: {
          pageAnalysis: number;
          elementDiscovery: number;
          resourceMonitoring: number;
        };
      };
    };
  }) {
    const expectedExecutionTimes = {
      pageAnalysis: config.performance.thresholds.executionTime.pageAnalysis,
      elementDiscovery:
        config.performance.thresholds.executionTime.elementDiscovery,
      resourceMonitoring:
        config.performance.thresholds.executionTime.resourceMonitoring,
    };

    const actualAverages = {
      pageAnalysis:
        this.stats.performanceMetrics.averageExecutionTime
          .analyzePageStructure ?? 0,
      elementDiscovery:
        this.stats.performanceMetrics.averageExecutionTime
          .findAlternativeElements ?? 0,
      resourceMonitoring:
        this.stats.performanceMetrics.averageExecutionTime.resourceMonitoring ??
        0,
    };

    const deviations = this.calculateDeviations(
      expectedExecutionTimes,
      actualAverages
    );

    return { expectedExecutionTimes, actualAverages, deviations };
  }

  private calculateDeviations(
    expected: Record<string, number>,
    actual: Record<string, number>
  ) {
    const deviations: Record<
      string,
      { percent: number; significance: SignificanceLevel }
    > = {};

    for (const key of Object.keys(expected)) {
      const expectedTime = expected[key];
      const actualTime = actual[key];

      if (actualTime > 0 && expectedTime > 0) {
        const percent = ((actualTime - expectedTime) / expectedTime) * 100;
        let significance: SignificanceLevel = 'normal';

        if (Math.abs(percent) > 50) {
          significance = 'significant';
        } else if (Math.abs(percent) > 25) {
          significance = 'notable';
        }

        deviations[key] = { percent: Math.round(percent), significance };
      }
    }

    return deviations;
  }

  private generateAllRecommendations(
    impactReport: {
      performanceImpact: {
        recommendedOptimizations: string[];
      };
      validationStatus: {
        warnings: string[];
      };
    },
    deviations: Record<string, { percent: number; significance: string }>
  ) {
    const recommendations: Array<{
      type: RecommendationType;
      message: string;
      priority: PriorityLevel;
    }> = [];

    // Add performance-based recommendations
    this.addPerformanceRecommendations(recommendations, deviations);

    // Add configuration-specific recommendations
    this.addConfigurationRecommendations(recommendations, impactReport);

    // Add error rate recommendations
    this.addErrorRateRecommendations(recommendations);

    return recommendations;
  }

  private addPerformanceRecommendations(
    recommendations: Array<{
      type: RecommendationType;
      message: string;
      priority: PriorityLevel;
    }>,
    deviations: Record<string, { percent: number; significance: string }>
  ) {
    for (const [component, deviation] of Object.entries(deviations)) {
      if (deviation.significance === 'significant') {
        if (deviation.percent > 50) {
          recommendations.push({
            type: 'warning',
            message: `${component} is taking ${Math.abs(deviation.percent)}% longer than expected - consider optimization`,
            priority: 'high',
          });
        } else if (deviation.percent < -50) {
          recommendations.push({
            type: 'info',
            message: `${component} is performing ${Math.abs(deviation.percent)}% faster than expected - thresholds may be too conservative`,
            priority: 'low',
          });
        }
      }
    }
  }

  private addConfigurationRecommendations(
    recommendations: Array<{
      type: RecommendationType;
      message: string;
      priority: PriorityLevel;
    }>,
    impactReport: {
      performanceImpact: {
        recommendedOptimizations: string[];
      };
      validationStatus: {
        warnings: string[];
      };
    }
  ) {
    if (impactReport.performanceImpact.recommendedOptimizations.length > 0) {
      for (const optimization of impactReport.performanceImpact
        .recommendedOptimizations) {
        recommendations.push({
          type: 'optimization',
          message: optimization,
          priority: 'medium',
        });
      }
    }

    for (const warning of impactReport.validationStatus.warnings) {
      recommendations.push({
        type: 'warning',
        message: warning,
        priority: 'medium',
      });
    }
  }

  private addErrorRateRecommendations(
    recommendations: Array<{
      type: RecommendationType;
      message: string;
      priority: PriorityLevel;
    }>
  ) {
    const totalErrors = Object.values(this.stats.errorCount).reduce(
      (sum, count) => sum + count,
      0
    );
    const errorRate =
      totalErrors / Math.max(this.stats.performanceMetrics.totalOperations, 1);

    if (errorRate > 0.05) {
      recommendations.push({
        type: 'warning',
        message: `Error rate is ${(errorRate * 100).toFixed(1)}% - consider reviewing recent failures`,
        priority: 'high',
      });
    }
  }

  private sortRecommendations(
    recommendations: Array<{
      type: RecommendationType;
      message: string;
      priority: PriorityLevel;
    }>
  ) {
    return recommendations.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  // Health check functionality
  performHealthCheck(): {
    status: HealthStatus;
    issues: string[];
    recommendations: string[];
  } {
    const issues: string[] = [];
    const recommendations: string[] = [];
    const config = this.configManager.getConfig();

    if (!this.initializationManager.getIsInitialized()) {
      issues.push('System not initialized');
      recommendations.push(
        'Call initializeComponents() to initialize the system'
      );
      return { status: 'critical', issues, recommendations };
    }

    const resourceStats = this.resourceManager?.getResourceStats();

    if (!resourceStats) {
      issues.push('Resource manager not initialized');
      recommendations.push('Initialize the system components');
      return { status: 'critical', issues, recommendations };
    }

    // Check resource usage
    if (resourceStats.activeCount > config.maxConcurrentHandles * 0.9) {
      issues.push(
        `High handle usage: ${resourceStats.activeCount}/${config.maxConcurrentHandles}`
      );
      recommendations.push(
        'Consider reducing concurrent operations or increasing maxConcurrentHandles'
      );
    }

    // Check error rate
    const totalErrors = Object.values(this.stats.errorCount).reduce(
      (sum, count) => sum + count,
      0
    );
    const errorRate =
      totalErrors / Math.max(this.stats.performanceMetrics.totalOperations, 1);

    if (errorRate > 0.1) {
      issues.push(`High error rate: ${(errorRate * 100).toFixed(1)}%`);
      recommendations.push(
        'Review recent errors and consider adjusting timeout thresholds'
      );
    }

    // Check performance
    const avgExecutionTimes = Object.values(
      this.stats.performanceMetrics.averageExecutionTime
    );
    const avgOverall =
      avgExecutionTimes.reduce((sum, time) => sum + time, 0) /
      Math.max(avgExecutionTimes.length, 1);

    if (avgOverall > 2000) {
      issues.push(`Slow performance: average ${avgOverall.toFixed(0)}ms`);
      recommendations.push(
        'Consider enabling parallel analysis or optimizing operations'
      );
    }

    let status: HealthStatus = 'healthy';
    if (issues.length > 2) {
      status = 'critical';
    } else if (issues.length > 0) {
      status = 'warning';
    }

    return { status, issues, recommendations };
  }

  // Cleanup and disposal
  async dispose(): Promise<void> {
    this.logger.info('Disposing UnifiedSystem');

    try {
      const disposePromises: Promise<void>[] = [];

      if (this.pageAnalyzer) {
        disposePromises.push(this.pageAnalyzer.dispose());
      }

      if (this.parallelAnalyzer) {
        disposePromises.push(this.parallelAnalyzer.dispose());
      }

      if (this.resourceManager) {
        disposePromises.push(this.resourceManager.dispose());
      }

      await Promise.all(disposePromises);
      await this.initializationManager.dispose();
    } catch (error) {
      this.logger.error('Error during disposal', error);
    }
  }
}
