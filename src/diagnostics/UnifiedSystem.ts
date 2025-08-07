/**
 * Unified diagnostic system that integrates all components
 */

import type * as playwright from 'playwright';
import { SmartConfigManager, type SmartConfig } from './SmartConfig.js';
import { DiagnosticError, type DiagnosticComponent } from './DiagnosticError.js';
import { PageAnalyzer } from './PageAnalyzer.js';
import { ParallelPageAnalyzer } from './ParallelPageAnalyzer.js';
import { ElementDiscovery } from './ElementDiscovery.js';
import { ResourceManager } from './ResourceManager.js';
import { EnhancedErrorHandler } from './EnhancedErrorHandler.js';
import { ResourceUsageMonitor } from './ResourceUsageMonitor.js';

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
  memoryUsage?: number;
}

export class UnifiedDiagnosticSystem {
  private static instances = new Map<playwright.Page, UnifiedDiagnosticSystem>();
  
  private readonly page: playwright.Page;
  private readonly configManager: SmartConfigManager;
  private readonly pageAnalyzer: PageAnalyzer;
  private readonly parallelAnalyzer: ParallelPageAnalyzer;
  private readonly elementDiscovery: ElementDiscovery;
  private readonly resourceManager: ResourceManager;
  private readonly errorHandler: EnhancedErrorHandler;
  private readonly resourceMonitor?: ResourceUsageMonitor;
  
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
    
    // Initialize components with unified configuration
    const componentConfig = this.configManager.getComponentConfig('pageAnalyzer');
    this.pageAnalyzer = new PageAnalyzer(page);
    this.parallelAnalyzer = new ParallelPageAnalyzer(page);
    this.elementDiscovery = new ElementDiscovery(page);
    this.resourceManager = new ResourceManager();
    this.errorHandler = new EnhancedErrorHandler(page, componentConfig.diagnostic);
    
    if (this.configManager.getConfig().features.enableResourceLeakDetection) {
      this.resourceMonitor = new ResourceUsageMonitor();
    }
    
    this.stats = this.initializeStats();
    this.setupConfigurationListener();
  }

  static getInstance(page: playwright.Page, config?: Partial<SmartConfig>): UnifiedDiagnosticSystem {
    if (!UnifiedDiagnosticSystem.instances.has(page)) {
      UnifiedDiagnosticSystem.instances.set(page, new UnifiedDiagnosticSystem(page, config));
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
        ConfigManager: 0
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
    this.configManager.onConfigChange((config) => {
      console.info('[UnifiedSystem] Configuration updated, reinitializing components if needed');
      
      // Update resource monitor based on new configuration
      if (config.features.enableResourceLeakDetection && !this.resourceMonitor) {
        // Resource monitor would need to be reinitialized
        console.info('[UnifiedSystem] Resource monitoring enabled');
      }
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
    
    let resourceSnapshot: any;
    if (this.resourceMonitor && (options?.enableResourceMonitoring ?? config.performance.enableResourceMonitoring)) {
      resourceSnapshot = await this.resourceMonitor.getResourceUsage();
    }

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
      if (config.performance.enablePerformanceWarnings) {
        const threshold = componentConfig.executionTimeout || 1000;
        if (executionTime > threshold) {
          console.warn(`[UnifiedSystem] Performance warning: ${operation} took ${executionTime}ms (threshold: ${threshold}ms)`);
        }
      }

      // Calculate memory usage if monitoring is enabled
      let memoryUsage: number | undefined;
      if (resourceSnapshot && this.resourceMonitor) {
        const currentUsage = await this.resourceMonitor.getResourceUsage();
        memoryUsage = currentUsage.memoryUsage.heapUsed - resourceSnapshot.memoryUsage.heapUsed;
        
        if (memoryUsage > config.performance.thresholds.memory.memoryLeakThreshold) {
          console.warn(`[UnifiedSystem] Memory usage warning: ${operation} used ${(memoryUsage / 1024 / 1024).toFixed(2)}MB`);
        }
      }

      return {
        success: true,
        data: result,
        executionTime,
        memoryUsage
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
          console.warn('[UnifiedSystem] Error enrichment failed:', enrichmentError);
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
    if (this.operationHistory.length > maxHistory) {
      this.operationHistory = this.operationHistory.slice(-maxHistory);
    }

    // Trigger adaptive threshold adjustment
    if (this.configManager.getConfig().runtime.enableAdaptiveThresholds) {
      const recentOps = this.operationHistory.filter(op => 
        op.operation === operation && 
        Date.now() - op.timestamp < 300000 // Last 5 minutes
      );
      
      if (recentOps.length >= 10) { // Enough data for adjustment
        const avgTime = recentOps.reduce((sum, op) => sum + op.executionTime, 0) / recentOps.length;
        const successRate = recentOps.filter(op => op.success).length / recentOps.length;
        
        if (component === 'PageAnalyzer') {
          this.configManager.adjustThresholds('pageAnalysis', avgTime, successRate);
        } else if (component === 'ElementDiscovery') {
          this.configManager.adjustThresholds('elementDiscovery', avgTime, successRate);
        } else if (component === 'ResourceManager') {
          this.configManager.adjustThresholds('resourceMonitoring', avgTime, successRate);
        }
      }
    }
  }

  private async enrichError(error: DiagnosticError, operation: string): Promise<DiagnosticError> {
    try {
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
          memoryUsage: error.memoryUsage,
          performanceImpact: error.performanceImpact,
          suggestions: [...error.suggestions, ...(enrichedPlaywrightError.suggestions || [])]
        },
        error.originalError
      );

      return enrichedDiagnosticError;
    } catch (enrichmentError) {
      // Return original error if enrichment fails
      console.warn('[UnifiedSystem] Error enrichment failed:', enrichmentError);
      return error;
    }
  }

  // High-level API methods that use the unified operation wrapper
  async analyzePageStructure(): Promise<OperationResult> {
    const config = this.configManager.getConfig();
    
    if (config.features.enableParallelAnalysis) {
      return this.executeOperation('analyzePageStructure', 'PageAnalyzer', async () => {
        const recommendation = await this.pageAnalyzer.shouldUseParallelAnalysis();
        
        if (recommendation.recommended) {
          return await this.parallelAnalyzer.runParallelAnalysis();
        } else {
          return await this.pageAnalyzer.analyzePageStructure();
        }
      });
    } else {
      return this.executeOperation('analyzePageStructure', 'PageAnalyzer', () =>
        this.pageAnalyzer.analyzePageStructure()
      );
    }
  }

  async findAlternativeElements(searchCriteria: any): Promise<OperationResult> {
    return this.executeOperation('findAlternativeElements', 'ElementDiscovery', () =>
      this.elementDiscovery.findAlternativeElements(searchCriteria)
    );
  }

  async analyzePerformanceMetrics(): Promise<OperationResult> {
    return this.executeOperation('analyzePerformanceMetrics', 'PageAnalyzer', () =>
      this.pageAnalyzer.analyzePerformanceMetrics()
    );
  }

  // Resource management with automatic cleanup
  async createSmartHandle<T>(
    creator: () => Promise<T>,
    disposer: (handle: T) => Promise<void>,
    options?: { timeout?: number; category?: string }
  ): Promise<T> {
    const handle = await creator();
    const smartHandle = this.resourceManager.createSmartHandle(handle, 'dispose' as keyof T);
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

  // Health check functionality
  async performHealthCheck(): Promise<{
    status: 'healthy' | 'warning' | 'critical';
    issues: string[];
    recommendations: string[];
  }> {
    const issues: string[] = [];
    const recommendations: string[] = [];
    const config = this.configManager.getConfig();
    const resourceStats = this.resourceManager.getResourceStats();

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
    console.info('[UnifiedSystem] Disposing unified diagnostic system');
    
    try {
      await Promise.all([
        this.pageAnalyzer.dispose(),
        this.parallelAnalyzer.dispose(),
        this.resourceManager.dispose()
      ]);
      
      if (this.resourceMonitor) {
        await this.resourceMonitor.dispose();
      }
      
      console.info('[UnifiedSystem] All components disposed successfully');
    } catch (error) {
      console.error('[UnifiedSystem] Error during disposal:', error);
    }
  }
}