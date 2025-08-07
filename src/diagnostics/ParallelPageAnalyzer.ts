/**
 * ParallelPageAnalyzer - Phase 2 Parallel Analysis Engine
 *
 * Performs parallel structure and performance analysis with resource monitoring
 */

import { Page } from 'playwright';
import { PageAnalyzer } from './PageAnalyzer.js';
import { ResourceUsageMonitor } from './ResourceUsageMonitor.js';
import { ParallelAnalysisResult } from '../types/performance.js';

export class ParallelPageAnalyzer {
  private page: Page;
  private pageAnalyzer: PageAnalyzer;
  private resourceMonitor: ResourceUsageMonitor;

  constructor(page: Page) {
    this.page = page;
    this.pageAnalyzer = new PageAnalyzer(page);
    this.resourceMonitor = new ResourceUsageMonitor();
  }

  /**
   * Run parallel analysis with resource monitoring
   */
  async runParallelAnalysis(): Promise<ParallelAnalysisResult> {
    const startTime = Date.now();
    const errors: Array<{ step: string; error: string }> = [];
    const analysisSteps: Array<{ step: string; duration: number; memoryDelta: number }> = [];

    // Starting parallel analysis with resource monitoring

    // Start global monitoring
    this.resourceMonitor.startMonitoring('parallel-analysis');
    const startMemory = this.resourceMonitor.getCurrentMemoryUsage();

    let structureAnalysis: any;
    let performanceMetrics: any;

    try {
      // Parallel execution of analysis tasks
      // Launching parallel analysis tasks
      const analysisPromises = [
        this.executeWithMonitoring('structure-analysis', async () => {
          return await this.pageAnalyzer.analyzePageStructure();
        }),
        this.executeWithMonitoring('performance-metrics', async () => {
          return await this.pageAnalyzer.analyzePerformanceMetrics();
        })
      ];

      const results = await Promise.allSettled(analysisPromises);
      // Parallel tasks completed

      // Process results
      results.forEach((result, index) => {
        const stepName = index === 0 ? 'structure-analysis' : 'performance-metrics';

        if (result.status === 'fulfilled') {
          const { data, step } = result.value;
          analysisSteps.push(step);
          // Step completed successfully

          if (stepName === 'structure-analysis')
            structureAnalysis = data;
          else
            performanceMetrics = data;

        } else {
          const errorMsg = result.reason?.message || 'Unknown error';
          // Step failed - continuing with error tracking
          errors.push({
            step: stepName,
            error: errorMsg
          });
        }
      });

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Parallel execution failed';
      // Parallel execution failed
      errors.push({
        step: 'parallel-execution',
        error: errorMsg
      });
    }

    // Stop global monitoring
    const globalUsage = await this.resourceMonitor.stopMonitoring('parallel-analysis');
    const endTime = Date.now();
    const executionTime = endTime - startTime;
    const endMemory = this.resourceMonitor.getCurrentMemoryUsage();

    // Parallel analysis completed

    return {
      structureAnalysis,
      performanceMetrics,
      resourceUsage: {
        memoryUsage: endMemory,
        cpuTime: globalUsage.duration,
        peakMemory: this.resourceMonitor.getPeakMemoryUsage(),
        analysisSteps
      },
      executionTime,
      errors
    };
  }

  /**
   * Execute analysis step with individual monitoring
   */
  private async executeWithMonitoring<T>(
    stepName: string,
    analysisFunction: () => Promise<T>
  ): Promise<{ data: T; step: { step: string; duration: number; memoryDelta: number } }> {
    // Starting analysis step
    const startMemory = this.resourceMonitor.getCurrentMemoryUsage();
    this.resourceMonitor.startMonitoring(stepName);

    try {
      const data = await analysisFunction();
      const usage = await this.resourceMonitor.stopMonitoring(stepName);
      const endMemory = this.resourceMonitor.getCurrentMemoryUsage();

      const step = {
        step: stepName,
        duration: usage.duration,
        memoryDelta: endMemory.heapUsed - startMemory.heapUsed
      };

      // Step completed with memory monitoring
      return { data, step };
    } catch (error) {
      // Step failed with error
      // Cleanup monitoring on error
      try {
        await this.resourceMonitor.stopMonitoring(stepName);
      } catch {
        // Ignore cleanup errors
      }
      throw error;
    }
  }

  /**
   * Get current resource usage snapshot
   */
  getCurrentResourceUsage() {
    return this.resourceMonitor.getCurrentMemoryUsage();
  }

  /**
   * Get operation timeline
   */
  getOperationTimeline() {
    return this.resourceMonitor.getOperationTimeline();
  }

  /**
   * Clear monitoring history
   */
  clearMonitoringHistory() {
    this.resourceMonitor.clearTimeline();
  }

  /**
   * Dispose resources
   */
  async dispose(): Promise<void> {
    await this.pageAnalyzer.dispose();
    this.resourceMonitor.dispose();
  }
}
