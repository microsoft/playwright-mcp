/**
 * Handles analysis execution for the diagnose tool
 */

import type {
  PageAnalyzer,
  PageStructureAnalysis,
} from '../../diagnostics/page-analyzer.js';
import type { UnifiedDiagnosticSystem } from '../../diagnostics/unified-system.js';
import type { PerformanceMetrics } from '../../types/performance.js';

export interface AnalysisResult {
  diagnosticInfo: PageStructureAnalysis;
  performanceMetrics?: PerformanceMetrics;
  systemHealthInfo?: {
    status: string;
    issues: string[];
    recommendations: string[];
    timestamp: number;
  };
  analysisType: string;
  executionTime?: number;
  analysisStatus: string;
  errors?: string[];
}

export class DiagnoseAnalysisRunner {
  async runAnalysis(
    unifiedSystem: UnifiedDiagnosticSystem | null,
    pageAnalyzer: PageAnalyzer | null,
    useParallelAnalysis: boolean,
    includeSystemStats: boolean
  ): Promise<AnalysisResult> {
    if (unifiedSystem) {
      return await this.runUnifiedSystemAnalysis(
        unifiedSystem,
        useParallelAnalysis,
        includeSystemStats
      );
    }
    if (useParallelAnalysis && pageAnalyzer) {
      return await this.runLegacyParallelAnalysis(pageAnalyzer);
    }
    if (pageAnalyzer) {
      return await this.runStandardAnalysis(pageAnalyzer);
    }
    throw new Error('No analysis system available');
  }

  private async runUnifiedSystemAnalysis(
    unifiedSystem: UnifiedDiagnosticSystem,
    useParallelAnalysis: boolean,
    includeSystemStats: boolean
  ): Promise<AnalysisResult> {
    const structureResult =
      await unifiedSystem.analyzePageStructure(useParallelAnalysis);

    if (!structureResult.success) {
      throw new Error(
        `Unified system analysis failed: ${structureResult.error?.message || 'Unknown error'}`
      );
    }

    let diagnosticInfo = structureResult.data as PageStructureAnalysis;
    let performanceMetrics: PerformanceMetrics | undefined;
    let analysisType: string;
    let analysisStatus: string;

    if ('structureAnalysis' in diagnosticInfo) {
      // Parallel analysis result
      // biome-ignore lint/suspicious/noExplicitAny: Complex diagnostic info structure requires type assertion
      performanceMetrics = (diagnosticInfo as any).performanceMetrics;
      // biome-ignore lint/suspicious/noExplicitAny: Complex diagnostic info structure requires type assertion
      diagnosticInfo = (diagnosticInfo as any).structureAnalysis;

      analysisType = `Enhanced Parallel Analysis (${structureResult.executionTime}ms)`;
      analysisStatus = 'Successfully executed with resource monitoring';
    } else {
      analysisType = `Standard Analysis (${structureResult.executionTime}ms)`;
      analysisStatus = useParallelAnalysis
        ? 'Parallel analysis requested but fell back to standard'
        : 'Standard analysis by configuration';
    }

    let systemHealthInfo: AnalysisResult['systemHealthInfo'];
    if (includeSystemStats) {
      const healthResult = await unifiedSystem.performHealthCheck();
      systemHealthInfo = {
        ...healthResult,
        timestamp: Date.now(),
      };
    }

    return {
      diagnosticInfo,
      performanceMetrics,
      systemHealthInfo,
      analysisType,
      executionTime: structureResult.executionTime,
      analysisStatus,
    };
  }

  private async runLegacyParallelAnalysis(
    pageAnalyzer: PageAnalyzer
  ): Promise<AnalysisResult> {
    const parallelRecommendation =
      await pageAnalyzer.shouldUseParallelAnalysis();

    if (parallelRecommendation.recommended) {
      const parallelResult = await pageAnalyzer.runParallelAnalysis();

      return {
        diagnosticInfo:
          parallelResult.structureAnalysis as PageStructureAnalysis,
        performanceMetrics: parallelResult.performanceMetrics,
        analysisType: 'Enhanced Diagnostic Report (Parallel Analysis)',
        executionTime: parallelResult.executionTime,
        analysisStatus: 'Parallel analysis completed successfully',
        errors: parallelResult.errors.map((err) => `${err.step}: ${err.error}`),
      };
    }
    const diagnosticInfo = await pageAnalyzer.analyzePageStructure();

    return {
      diagnosticInfo,
      analysisType: 'Standard Diagnostic Report',
      analysisStatus: `Parallel Analysis: Not recommended - ${parallelRecommendation.reason}`,
    };
  }

  private async runStandardAnalysis(
    pageAnalyzer: PageAnalyzer
  ): Promise<AnalysisResult> {
    const diagnosticInfo = await pageAnalyzer.analyzePageStructure();

    return {
      diagnosticInfo,
      analysisType: 'Standard Analysis',
      analysisStatus: 'Standard analysis completed',
    };
  }
}
