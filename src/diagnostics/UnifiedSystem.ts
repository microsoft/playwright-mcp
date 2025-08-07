/**
 * Unified diagnostic system that integrates all components
 */

import { SmartConfigManager  } from './SmartConfig.js';
import { DiagnosticError  } from './DiagnosticError.js';
import { PageAnalyzer } from './PageAnalyzer.js';
import { ParallelPageAnalyzer } from './ParallelPageAnalyzer.js';
import { ElementDiscovery } from './ElementDiscovery.js';
import { ResourceManager } from './ResourceManager.js';
import { EnhancedErrorHandler } from './EnhancedErrorHandler.js';
import type { DiagnosticComponent } from './DiagnosticError.js';
import type { SmartConfig } from './SmartConfig.js';
import type * as playwright from 'playwright';

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

export interface OperationResult<T = any> {
  success: boolean;
  data?: T;
  error?: DiagnosticError;
  executionTime: number;
}

export class UnifiedDiagnosticSystem {
  private static instances = new Map<playwright.Page, UnifiedDiagnosticSystem>();

  private readonly page: playwright.Page;
  private readonly configManager: SmartConfigManager;
  private pageAnalyzer?: PageAnalyzer;
  private parallelAnalyzer?: ParallelPageAnalyzer;
  private elementDiscovery?: ElementDiscovery;
  private resourceManager?: ResourceManager;
  private errorHandler?: EnhancedErrorHandler;

  // Initialization state management
  private isInitialized: boolean = false;
  private initializationPromise?: Promise<void>;
  private initializationError?: DiagnosticError;

  private stats: SystemStats;
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

    // Initialize basic stats and listener setup
    this.stats = this.initializeStats();
    this.setupConfigurationListener();

    // Note: Component initialization moved to initializeComponents method
    // This follows the create-then-initialize pattern for better error handling
  }

  /**
   * Initialize all diagnostic components in dependency order
   * This method handles component dependencies and provides proper cleanup on failure
   */
  async initializeComponents(): Promise<void> {
    if (this.isInitialized)
      return;


    if (this.initializationPromise)
      return this.initializationPromise;


    if (this.initializationError)
      throw this.initializationError;


    this.initializationPromise = this.performInitialization();

    try {
      await this.initializationPromise;
      this.isInitialized = true;
    } catch (error) {
      this.initializationError = error instanceof DiagnosticError
        ? error
        : DiagnosticError.from(
            error as Error,
            'UnifiedSystem',
            'initializeComponents',
            { timestamp: Date.now() }
        );
      throw this.initializationError;
    } finally {
      this.initializationPromise = undefined;
    }
  }

  private async performInitialization(): Promise<void> {
    const initializationStages: Array<{
      name: string;
      components: (() => Promise<void>)[];
      dependencies?: string[];
    }> = [
      {
        name: 'core-infrastructure',
        components: [
          // Stage 1: Core components without external dependencies
          async () => {
            this.resourceManager = new ResourceManager();
          }
        ]
      },
      {
        name: 'page-dependent',
        dependencies: ['core-infrastructure'],
        components: [
          // Stage 2: Components that depend on page but not other components
          async () => {
            const componentConfig = this.configManager.getComponentConfig('pageAnalyzer');
            this.pageAnalyzer = new PageAnalyzer(this.page);
            this.elementDiscovery = new ElementDiscovery(this.page);
            this.errorHandler = new EnhancedErrorHandler(this.page, componentConfig.diagnostic);
          }
        ]
      },
      {
        name: 'advanced-features',
        dependencies: ['core-infrastructure', 'page-dependent'],
        components: [
          // Stage 3: Advanced components that depend on other components
          async () => {
            this.parallelAnalyzer = new ParallelPageAnalyzer(this.page);

            // Initialize optional components based on configuration

          }
        ]
      }
    ];

    const completedStages: Set<string> = new Set();
    const partiallyInitializedComponents: Array<{ dispose: () => Promise<void> }> = [];

    try {
      for (const stage of initializationStages) {
        // console.info(`[UnifiedSystem] Initializing stage: ${stage.name}`);

        // Check dependencies
        if (stage.dependencies) {
          for (const dep of stage.dependencies) {
            if (!completedStages.has(dep))
              throw new Error(`Dependency '${dep}' not satisfied for stage '${stage.name}'`);

          }
        }

        // Execute all components in this stage
        for (const componentInit of stage.components)
          await componentInit();


        // Track components for cleanup if needed
        this.collectDisposableComponents(partiallyInitializedComponents);

        completedStages.add(stage.name);
        // console.info(`[UnifiedSystem] Stage '${stage.name}' completed successfully`);
      }

      // console.info('[UnifiedSystem] All components initialized successfully');

    } catch (error) {
      // console.error(`[UnifiedSystem] Initialization failed:`, error);

      // Clean up any partially initialized components
      await this.cleanupPartialInitialization(partiallyInitializedComponents);

      // Create detailed diagnostic error
      const diagnosticError = new DiagnosticError(
          `Component initialization failed: ${error instanceof Error ? error.message : String(error)}`,
          {
            timestamp: Date.now(),
            component: 'UnifiedSystem',
            operation: 'initializeComponents',
            context: {
              stage: completedStages.size > 0 ? Array.from(completedStages).pop() : 'initialization-start',
              completedStages: Array.from(completedStages),
              failedComponents: partiallyInitializedComponents.length
            },
            suggestions: [
              'Review component dependencies',
              'Check page availability',
              'Verify configuration settings',
              'Ensure sufficient resources'
            ]
          },
        error as Error
      );

      throw diagnosticError;
    }
  }

  private collectDisposableComponents(components: Array<{ dispose: () => Promise<void> }>): void {
    // Add currently initialized components that have dispose methods
    if (this.resourceManager)
      components.push(this.resourceManager as any);

    if (this.pageAnalyzer)
      components.push(this.pageAnalyzer as any);

    if (this.parallelAnalyzer)
      components.push(this.parallelAnalyzer as any);
  }

  private async cleanupPartialInitialization(components: Array<{ dispose: () => Promise<void> }>): Promise<void> {
    // console.info('[UnifiedSystem] Cleaning up partially initialized components');

    for (const component of components) {
      try {
        if (component && typeof component.dispose === 'function')
          await component.dispose();

      } catch (cleanupError) {
        // console.warn('[UnifiedSystem] Error during component cleanup:', cleanupError);
      }
    }

    // Reset component references
    this.pageAnalyzer = undefined;
    this.parallelAnalyzer = undefined;
    this.elementDiscovery = undefined;
    this.resourceManager = undefined;
    this.errorHandler = undefined;
  }

  /**
   * Ensure components are initialized before performing operations
   * This method provides automatic initialization for API methods
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized && !this.initializationPromise)
      await this.initializeComponents();
    else if (this.initializationPromise)
      await this.initializationPromise;


    if (!this.isInitialized) {
      throw new DiagnosticError(
          'UnifiedSystem components are not initialized',
          {
            timestamp: Date.now(),
            component: 'UnifiedSystem',
            operation: 'ensureInitialized',
            suggestions: [
              'Call initializeComponents() before using the system',
              'Check for initialization errors',
              'Verify page and configuration are valid'
            ]
          }
      );
    }
  }

  static getInstance(page: playwright.Page, config?: Partial<SmartConfig>): UnifiedDiagnosticSystem {
    if (!UnifiedDiagnosticSystem.instances.has(page)) {
      const instance = new UnifiedDiagnosticSystem(page, config);
      UnifiedDiagnosticSystem.instances.set(page, instance);
      // Initialize components asynchronously without blocking getInstance
      void instance.initializeComponents().catch(error => {
        // Initialization errors will be caught when methods are called
      });
    }
    return UnifiedDiagnosticSystem.instances.get(page)!;
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
        UnifiedSystem: 0
      },
      performanceMetrics: {
        averageExecutionTime: {},
        peakMemoryUsage: 0,
        totalOperations: 0,
        successRate: 1.0
      },
      resourceUsage: {
        currentHandles: 0,
        peakHandles: 0,
        memoryLeaks: 0,
        autoDisposeCount: 0
      }
    };
  }

  private setupConfigurationListener(): void {
    this.configManager.onConfigChange(config => {
      // console.info('[UnifiedSystem] Configuration updated, reinitializing components if needed');
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
    const componentConfig = this.configManager.getComponentConfig(
      component.toLowerCase() as 'pageAnalyzer' | 'elementDiscovery' | 'resourceManager'
    );


    try {
      // Apply timeout if specified
      const timeout = options?.timeout || componentConfig.executionTimeout || 10000;
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`Operation timeout after ${timeout}ms`)), timeout);
      });

      const result = await Promise.race([fn(), timeoutPromise]);
      const executionTime = Date.now() - startTime;

      // Record successful operation
      this.recordOperation(operation, component, executionTime, true);

      // Check for performance issues


      return {
        success: true,
        data: result,
        executionTime
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;

      // Record failed operation
      this.recordOperation(operation, component, executionTime, false);
      this.stats.errorCount[component]++;

      // Create enhanced diagnostic error
      const diagnosticError = error instanceof DiagnosticError
        ? error
        : DiagnosticError.from(
            error as Error,
            component,
            operation,
            { executionTime, timestamp: startTime }
        );

      // Apply error enrichment if enabled
      let enrichedError = diagnosticError;
      if (config.errorHandling.enableErrorEnrichment) {
        try {
          enrichedError = await this.enrichError(diagnosticError, operation);
        } catch (enrichmentError) {
          // console.warn('[UnifiedSystem] Error enrichment failed:', enrichmentError);
        }
      }

      return {
        success: false,
        error: enrichedError,
        executionTime
      };
    }
  }

  private recordOperation(operation: string, component: DiagnosticComponent, executionTime: number, success: boolean): void {
    // Update operation count
    this.stats.operationCount[operation] = (this.stats.operationCount[operation] || 0) + 1;

    // Update performance metrics
    const currentAvg = this.stats.performanceMetrics.averageExecutionTime[operation] || 0;
    const currentCount = this.stats.operationCount[operation];
    this.stats.performanceMetrics.averageExecutionTime[operation] =
      (currentAvg * (currentCount - 1) + executionTime) / currentCount;

    this.stats.performanceMetrics.totalOperations++;

    // Update success rate
    const successfulOps = this.operationHistory.filter(op => op.success).length + (success ? 1 : 0);
    const totalOps = this.operationHistory.length + 1;
    this.stats.performanceMetrics.successRate = successfulOps / totalOps;

    // Add to operation history (maintain limited size)
    this.operationHistory.push({
      operation,
      component,
      timestamp: Date.now(),
      executionTime,
      success
    });

    const maxHistory = this.configManager.getConfig().errorHandling.maxErrorHistory;
    if (this.operationHistory.length > maxHistory)
      this.operationHistory = this.operationHistory.slice(-maxHistory);


    // Trigger adaptive threshold adjustment
    if (this.configManager.getConfig().runtime.enableAdaptiveThresholds) {
      const recentOps = this.operationHistory.filter(op =>
        op.operation === operation &&
        Date.now() - op.timestamp < 300000 // Last 5 minutes
      );

      if (recentOps.length >= 10) { // Enough data for adjustment
        const avgTime = recentOps.reduce((sum, op) => sum + op.executionTime, 0) / recentOps.length;
        const successRate = recentOps.filter(op => op.success).length / recentOps.length;

        if (component === 'PageAnalyzer')
          this.configManager.adjustThresholds('pageAnalysis', avgTime, successRate);
        else if (component === 'ElementDiscovery')
          this.configManager.adjustThresholds('elementDiscovery', avgTime, successRate);
        else if (component === 'ResourceManager')
          this.configManager.adjustThresholds('resourceMonitoring', avgTime, successRate);

      }
    }
  }

  private async enrichError(error: DiagnosticError, operation: string): Promise<DiagnosticError> {
    try {
      if (!this.errorHandler)
        return error; // Return original error if handler is not initialized


      // Use the enhanced error handler for context-aware enrichment
      const enrichedPlaywrightError = await this.errorHandler.enhanceToolError({
        toolName: operation,
        error: new Error(error.message),
        toolArgs: { component: error.component, operation: error.operation }
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
            suggestions: [...error.suggestions, ...(enrichedPlaywrightError.suggestions || [])]
          },
          error.originalError
      );

      return enrichedDiagnosticError;
    } catch (enrichmentError) {
      // Return original error if enrichment fails
      // console.warn('[UnifiedSystem] Error enrichment failed:', enrichmentError);
      return error;
    }
  }

  // High-level API methods that use the unified operation wrapper
  async analyzePageStructure(forceParallel?: boolean): Promise<OperationResult> {
    await this.ensureInitialized();
    const config = this.configManager.getConfig();

    // Determine analysis mode with clear logging
    const shouldUseParallel = forceParallel ?? config.features.enableParallelAnalysis;

    if (shouldUseParallel) {
      // console.info(`[UnifiedSystem] Using parallel analysis - forced: ${forceParallel === true}, config enabled: ${config.features.enableParallelAnalysis}`);

      return this.executeOperation('analyzePageStructure', 'PageAnalyzer', async () => {
        const recommendation = await this.pageAnalyzer!.shouldUseParallelAnalysis();

        if (recommendation.recommended || forceParallel) {
          // console.info(`[UnifiedSystem] Parallel analysis execution - recommendation: ${recommendation.recommended}, forced: ${forceParallel === true}`);
          if (!recommendation.recommended && forceParallel) {
            // console.info(`[UnifiedSystem] Overriding recommendation (${recommendation.reason}) due to force flag`);
          }
          return await this.parallelAnalyzer!.runParallelAnalysis();
        } else {
          // console.info(`[UnifiedSystem] Falling back to standard analysis - reason: ${recommendation.reason}`);
          return await this.pageAnalyzer!.analyzePageStructure();
        }
      });
    } else {
      // console.info('[UnifiedSystem] Using standard analysis - parallel analysis disabled');
      return this.executeOperation('analyzePageStructure', 'PageAnalyzer', () =>
        this.pageAnalyzer!.analyzePageStructure()
      );
    }
  }

  async findAlternativeElements(searchCriteria: any): Promise<OperationResult> {
    await this.ensureInitialized();
    return this.executeOperation('findAlternativeElements', 'ElementDiscovery', () =>
      this.elementDiscovery!.findAlternativeElements(searchCriteria)
    );
  }

  async analyzePerformanceMetrics(): Promise<OperationResult> {
    await this.ensureInitialized();
    return this.executeOperation('analyzePerformanceMetrics', 'PageAnalyzer', () =>
      this.pageAnalyzer!.analyzePerformanceMetrics()
    );
  }

  // Resource management with automatic cleanup
  async createSmartHandle<T>(
    creator: () => Promise<T>,
    disposer: (handle: T) => Promise<void>,
    options?: { timeout?: number; category?: string }
  ): Promise<T> {
    await this.ensureInitialized();
    const handle = await creator();
    const smartHandle = this.resourceManager!.createSmartHandle(handle, 'dispose' as keyof T);
    return smartHandle.handle;
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
    if (!this.isInitialized || !this.resourceManager)
      return this.stats;


    const currentResourceUsage = this.resourceManager.getResourceStats();

    return {
      ...this.stats,
      resourceUsage: {
        ...this.stats.resourceUsage,
        currentHandles: currentResourceUsage.activeCount,
        peakHandles: Math.max(this.stats.resourceUsage.peakHandles || 0, currentResourceUsage.activeCount)
      }
    };
  }

  getRecentOperations(limit: number = 50): Array<{
    operation: string;
    component: DiagnosticComponent;
    timestamp: number;
    executionTime: number;
    success: boolean;
  }> {
    return this.operationHistory.slice(-limit);
  }

  // Configuration impact reporting
  getConfigurationReport(): {
    configurationStatus: 'default' | 'customized' | 'heavily-customized';
    appliedOverrides: {
      category: string;
      changes: string[];
      impact: 'low' | 'medium' | 'high';
    }[];
    performanceBaseline: {
      expectedExecutionTimes: Record<string, number>;
      actualAverages: Record<string, number>;
      deviations: Record<string, { percent: number; significance: 'normal' | 'notable' | 'significant' }>;
    };
    recommendations: {
      type: 'optimization' | 'warning' | 'info';
      message: string;
      priority: 'low' | 'medium' | 'high';
    }[];
    } {
    const config = this.configManager.getConfig();
    const impactReport = this.configManager.getConfigurationImpactReport();
    const configSummary = this.configManager.getConfigurationSummary();

    // Determine configuration status
    let configurationStatus: 'default' | 'customized' | 'heavily-customized' = 'default';
    if (configSummary.totalOverrides > 0)
      configurationStatus = configSummary.totalOverrides > 5 ? 'heavily-customized' : 'customized';


    // Organize overrides by category
    const appliedOverrides = [
      {
        category: 'Performance Thresholds',
        changes: Object.entries(impactReport.performanceImpact.executionTimeChanges).map(
            ([component, change]) => `${component}: ${change.from}ms → ${change.to}ms (${change.percentChange > 0 ? '+' : ''}${change.percentChange}%)`
        ),
        impact: Object.keys(impactReport.performanceImpact.executionTimeChanges).length > 2 ? 'high' as const : 'medium' as const
      },
      {
        category: 'Feature Flags',
        changes: [
          ...impactReport.featureChanges.enabled.map(feature => `${feature}: Enabled`),
          ...impactReport.featureChanges.disabled.map(feature => `${feature}: Disabled`),
          ...impactReport.featureChanges.modified
        ],
        impact: (impactReport.featureChanges.enabled.length + impactReport.featureChanges.disabled.length) > 2 ? 'medium' as const : 'low' as const
      }
    ].filter(override => override.changes.length > 0);

    // Calculate performance baselines and deviations
    const expectedExecutionTimes = {
      pageAnalysis: config.performance.thresholds.executionTime.pageAnalysis,
      elementDiscovery: config.performance.thresholds.executionTime.elementDiscovery,
      resourceMonitoring: config.performance.thresholds.executionTime.resourceMonitoring
    };

    const actualAverages = {
      pageAnalysis: this.stats.performanceMetrics.averageExecutionTime.analyzePageStructure || 0,
      elementDiscovery: this.stats.performanceMetrics.averageExecutionTime.findAlternativeElements || 0,
      resourceMonitoring: this.stats.performanceMetrics.averageExecutionTime.resourceMonitoring || 0
    };

    const deviations: Record<string, { percent: number; significance: 'normal' | 'notable' | 'significant' }> = {};
    Object.keys(expectedExecutionTimes).forEach(key => {
      const expected = expectedExecutionTimes[key as keyof typeof expectedExecutionTimes];
      const actual = actualAverages[key as keyof typeof actualAverages];

      if (actual > 0 && expected > 0) {
        const percent = ((actual - expected) / expected) * 100;
        let significance: 'normal' | 'notable' | 'significant' = 'normal';

        if (Math.abs(percent) > 50)
          significance = 'significant';
        else if (Math.abs(percent) > 25)
          significance = 'notable';


        deviations[key] = { percent: Math.round(percent), significance };
      }
    });

    // Generate recommendations
    const recommendations: { type: 'optimization' | 'warning' | 'info'; message: string; priority: 'low' | 'medium' | 'high' }[] = [];

    // Add performance-based recommendations
    Object.entries(deviations).forEach(([component, deviation]) => {
      if (deviation.significance === 'significant') {
        if (deviation.percent > 50) {
          recommendations.push({
            type: 'warning',
            message: `${component} is taking ${Math.abs(deviation.percent)}% longer than expected - consider optimization`,
            priority: 'high'
          });
        } else if (deviation.percent < -50) {
          recommendations.push({
            type: 'info',
            message: `${component} is performing ${Math.abs(deviation.percent)}% faster than expected - thresholds may be too conservative`,
            priority: 'low'
          });
        }
      }
    });

    // Add configuration-specific recommendations
    if (impactReport.performanceImpact.recommendedOptimizations.length > 0) {
      impactReport.performanceImpact.recommendedOptimizations.forEach(optimization => {
        recommendations.push({
          type: 'optimization',
          message: optimization,
          priority: 'medium'
        });
      });
    }

    // Add validation warnings as recommendations
    impactReport.validationStatus.warnings.forEach(warning => {
      recommendations.push({
        type: 'warning',
        message: warning,
        priority: 'medium'
      });
    });

    // Add error rate recommendations
    const totalErrors = Object.values(this.stats.errorCount).reduce((sum, count) => sum + count, 0);
    const errorRate = totalErrors / Math.max(this.stats.performanceMetrics.totalOperations, 1);

    if (errorRate > 0.05) {
      recommendations.push({
        type: 'warning',
        message: `Error rate is ${(errorRate * 100).toFixed(1)}% - consider reviewing recent failures`,
        priority: 'high'
      });
    }

    return {
      configurationStatus,
      appliedOverrides,
      performanceBaseline: {
        expectedExecutionTimes,
        actualAverages,
        deviations
      },
      recommendations: recommendations.sort((a, b) => {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      })
    };
  }

  // Health check functionality
  async performHealthCheck(): Promise<{
    status: 'healthy' | 'warning' | 'critical';
    issues: string[];
    recommendations: string[];
  }> {
    const issues: string[] = [];
    const recommendations: string[] = [];
    const config = this.configManager.getConfig();

    if (!this.isInitialized) {
      issues.push('System not initialized');
      recommendations.push('Call initializeComponents() to initialize the system');
      return { status: 'critical', issues, recommendations };
    }

    const resourceStats = this.resourceManager!.getResourceStats();

    // Check resource usage
    if (resourceStats.activeCount > config.maxConcurrentHandles * 0.9) {
      issues.push(`High handle usage: ${resourceStats.activeCount}/${config.maxConcurrentHandles}`);
      recommendations.push('Consider reducing concurrent operations or increasing maxConcurrentHandles');
    }

    // Check error rate
    const totalErrors = Object.values(this.stats.errorCount).reduce((sum, count) => sum + count, 0);
    const errorRate = totalErrors / Math.max(this.stats.performanceMetrics.totalOperations, 1);

    if (errorRate > 0.1) {
      issues.push(`High error rate: ${(errorRate * 100).toFixed(1)}%`);
      recommendations.push('Review recent errors and consider adjusting timeout thresholds');
    }

    // Check performance
    const avgExecutionTimes = Object.values(this.stats.performanceMetrics.averageExecutionTime);
    const avgOverall = avgExecutionTimes.reduce((sum, time) => sum + time, 0) / Math.max(avgExecutionTimes.length, 1);

    if (avgOverall > 2000) {
      issues.push(`Slow performance: average ${avgOverall.toFixed(0)}ms`);
      recommendations.push('Consider enabling parallel analysis or optimizing operations');
    }

    const status = issues.length > 2 ? 'critical' : issues.length > 0 ? 'warning' : 'healthy';

    return { status, issues, recommendations };
  }

  // Cleanup and disposal
  async dispose(): Promise<void> {
    // console.info('[UnifiedSystem] Disposing unified diagnostic system');

    try {
      const disposePromises: Promise<void>[] = [];

      if (this.pageAnalyzer)
        disposePromises.push(this.pageAnalyzer.dispose());

      if (this.parallelAnalyzer)
        disposePromises.push(this.parallelAnalyzer.dispose());

      if (this.resourceManager)
        disposePromises.push(this.resourceManager.dispose());

      await Promise.all(disposePromises);

      // Reset initialization state
      this.isInitialized = false;
      this.initializationPromise = undefined;
      this.initializationError = undefined;

      // console.info('[UnifiedSystem] All components disposed successfully');
    } catch (error) {
      // console.error('[UnifiedSystem] Error during disposal:', error);
    }
  }
}
