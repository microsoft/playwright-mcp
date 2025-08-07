/**
 * ParallelPageAnalyzer - Phase 2 Parallel Analysis Engine
 *
 * Performs parallel structure and performance analysis
 */

import { Page } from 'playwright';
import { PageAnalyzer } from './PageAnalyzer.js';
import { ParallelAnalysisResult } from '../types/performance.js';

export class ParallelPageAnalyzer {
  private page: Page;
  private pageAnalyzer: PageAnalyzer;

  constructor(page: Page) {
    this.page = page;
    this.pageAnalyzer = new PageAnalyzer(page);
  }

  /**
   * Run parallel analysis
   */
  async runParallelAnalysis(): Promise<ParallelAnalysisResult> {
    const startTime = Date.now();
    const errors: Array<{ step: string; error: string }> = [];

    let structureAnalysis: any;
    let performanceMetrics: any;

    try {
      // Parallel execution of analysis tasks
      const analysisPromises = [
        this.executeAnalysis('structure-analysis', async () => {
          return await this.pageAnalyzer.analyzePageStructure();
        }),
        this.executeAnalysis('performance-metrics', async () => {
          return await this.pageAnalyzer.analyzePerformanceMetrics();
        })
      ];

      const results = await Promise.allSettled(analysisPromises);

      // Process results
      results.forEach((result, index) => {
        const stepName = index === 0 ? 'structure-analysis' : 'performance-metrics';

        if (result.status === 'fulfilled') {
          if (stepName === 'structure-analysis') {
            structureAnalysis = result.value;
          } else {
            performanceMetrics = result.value;
          }
        } else {
          const errorMsg = result.reason?.message || 'Unknown error';
          errors.push({
            step: stepName,
            error: errorMsg
          });
        }
      });

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Parallel execution failed';
      errors.push({
        step: 'parallel-execution',
        error: errorMsg
      });
    }

    const executionTime = Date.now() - startTime;

    return {
      structureAnalysis,
      performanceMetrics,
      resourceUsage: null,
      executionTime,
      errors
    };
  }

  /**
   * Execute analysis step
   */
  private async executeAnalysis<T>(
    stepName: string,
    analysisFunction: () => Promise<T>
  ): Promise<T> {
    return await analysisFunction();
  }

  /**
   * Cleanup resources
   */
  async dispose(): Promise<void> {
    // Dispose the internal pageAnalyzer
    if (this.pageAnalyzer) {
      await this.pageAnalyzer.dispose();
    }
  }
}