/**
 * ParallelPageAnalyzer - Phase 2 Parallel Analysis Engine
 *
 * Performs parallel structure and performance analysis
 */

import type { Page } from 'playwright';
import type { ParallelAnalysisResult } from '../types/performance.js';
import { createDisposableManager } from '../utils/disposableManager.js';
import { PageAnalyzer } from './page-analyzer.js';

export class ParallelPageAnalyzer {
  private readonly pageAnalyzer: PageAnalyzer;
  private readonly disposableManager = createDisposableManager(
    'ParallelPageAnalyzer'
  );

  constructor(page: Page) {
    this.pageAnalyzer = this.disposableManager.register(new PageAnalyzer(page));
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
      const processedResults = this.processAnalysisResults(results, errors);
      structureAnalysis = processedResults.structureAnalysis;
      performanceMetrics = processedResults.performanceMetrics;
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : 'Parallel execution failed';
      errors.push({
        step: 'parallel-execution',
        error: errorMsg,
      });
    }

    const executionTime = Date.now() - startTime;

    // Convert PageStructureAnalysis to ParallelAnalysisResult.structureAnalysis format
    const convertedStructureAnalysis = structureAnalysis
      ? {
          iframes: {
            detected: structureAnalysis.iframes.detected,
            count: structureAnalysis.iframes.count,
            accessible: structureAnalysis.iframes.accessible.map((iframe) => ({
              id: iframe.src || 'unknown',
              url: iframe.src || '',
              title: iframe.src || 'iframe',
              contentAccessible: iframe.accessible,
              crossOrigin: false, // PageStructureAnalysis doesn't track this
            })),
            inaccessible: structureAnalysis.iframes.inaccessible.map(
              (iframe, index) => ({
                id: iframe.reason || `inaccessible-${index}`,
                reason: iframe.reason || 'Unknown reason',
                url: iframe.src,
                title: iframe.src || 'inaccessible iframe',
              })
            ),
          },
          modalStates: structureAnalysis.modalStates,
          elements: structureAnalysis.elements,
        }
      : {
          iframes: {
            detected: false,
            count: 0,
            accessible: [],
            inaccessible: [],
          },
          modalStates: {
            hasDialog: false,
            hasFileChooser: false,
            blockedBy: [],
          },
          elements: { totalVisible: 0, totalInteractable: 0, missingAria: 0 },
        };

    return {
      structureAnalysis: convertedStructureAnalysis,
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
   * Process analysis results
   */
  private processAnalysisResults(
    results: PromiseSettledResult<unknown>[],
    errors: Array<{ step: string; error: string }>
  ): {
    structureAnalysis?: import('./page-analyzer.js').PageStructureAnalysis;
    performanceMetrics?: import('../types/performance.js').PerformanceMetrics;
  } {
    let structureAnalysis:
      | import('./page-analyzer.js').PageStructureAnalysis
      | undefined;
    let performanceMetrics:
      | import('../types/performance.js').PerformanceMetrics
      | undefined;

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

    return { structureAnalysis, performanceMetrics };
  }

  /**
   * Cleanup resources
   */
  async dispose(): Promise<void> {
    await this.disposableManager.dispose();
  }
}
