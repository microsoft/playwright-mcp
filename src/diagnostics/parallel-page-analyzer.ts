/**
 * ParallelPageAnalyzer - Phase 2 Parallel Analysis Engine
 *
 * Performs parallel structure and performance analysis
 */

import type { Page } from 'playwright';
import type { ParallelAnalysisResult } from '../types/performance.js';
import { PageAnalyzer } from './page-analyzer.js';

export class ParallelPageAnalyzer {
  private readonly pageAnalyzer: PageAnalyzer;

  constructor(page: Page) {
    this.pageAnalyzer = new PageAnalyzer(page);
  }

  /**
   * Run parallel analysis
   */
  async runParallelAnalysis(): Promise<ParallelAnalysisResult> {
    const startTime = Date.now();
    const errors: Array<{ step: string; error: string }> = [];

    let structureAnalysis:
      | import('./page-analyzer.js').PageStructureAnalysis
      | undefined;
    let performanceMetrics:
      | import('../types/performance.js').PerformanceMetrics
      | undefined;

    try {
      // Parallel execution of analysis tasks
      const analysisPromises = [
        this.executeAnalysis('structure-analysis', async () => {
          return await this.pageAnalyzer.analyzePageStructure();
        }),
        this.executeAnalysis('performance-metrics', async () => {
          return await this.pageAnalyzer.analyzePerformanceMetrics();
        }),
      ];

      const results = await Promise.allSettled(analysisPromises);

      // Process results
      for (let index = 0; index < results.length; index++) {
        const result = results[index];
        const stepName =
          index === 0 ? 'structure-analysis' : 'performance-metrics';

        if (result.status === 'fulfilled') {
          if (stepName === 'structure-analysis') {
            // biome-ignore lint/suspicious/noExplicitAny: Type assertion needed for dynamic analysis result
            structureAnalysis = result.value as any;
          } else {
            // biome-ignore lint/suspicious/noExplicitAny: Type assertion needed for dynamic analysis result
            performanceMetrics = result.value as any;
          }
        } else {
          const errorMsg = result.reason?.message ?? 'Unknown error';
          errors.push({
            step: stepName,
            error: errorMsg,
          });
        }
      }
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : 'Parallel execution failed';
      errors.push({
        step: 'parallel-execution',
        error: errorMsg,
      });
    }

    const executionTime = Date.now() - startTime;

    return {
      structureAnalysis: {
        // biome-ignore lint/suspicious/noExplicitAny: Type assertion needed for optional analysis result properties
        domMetrics: (structureAnalysis as any)?.domMetrics,
        // biome-ignore lint/suspicious/noExplicitAny: Type assertion needed for optional analysis result properties
        interactionMetrics: (structureAnalysis as any)?.interactionMetrics,
        // biome-ignore lint/suspicious/noExplicitAny: Type assertion needed for optional analysis result properties
        layoutMetrics: (structureAnalysis as any)?.layoutMetrics,
        // biome-ignore lint/suspicious/noExplicitAny: Type assertion needed for optional analysis result properties
        resourceMetrics: (structureAnalysis as any)?.resourceMetrics,
      },
      // biome-ignore lint/suspicious/noExplicitAny: Type assertion needed for fallback empty performance metrics
      performanceMetrics: performanceMetrics ?? ({} as any),
      resourceUsage: null,
      executionTime,
      errors,
    };
  }

  /**
   * Execute analysis step
   */
  private async executeAnalysis<T>(
    _stepName: string,
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
