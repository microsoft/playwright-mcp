/**
 * browser_diagnose tool - Comprehensive page diagnostic information
 */

import { z } from 'zod';
import { expectationSchema } from '../schemas/expectation.js';
import { DiagnoseAnalysisRunner } from './diagnose/DiagnoseAnalysisRunner.js';
import type { ConfigOverrides } from './diagnose/DiagnoseConfigHandler.js';
import { DiagnoseConfigHandler } from './diagnose/DiagnoseConfigHandler.js';
import type { SearchCriteria } from './diagnose/DiagnoseReportBuilder.js';
import { DiagnoseReportBuilder } from './diagnose/DiagnoseReportBuilder.js';
import { defineTabTool } from './tool.js';

const diagnoseSchema = z
  .object({
    searchForElements: z
      .object({
        text: z.string().optional(),
        role: z.string().optional(),
        tagName: z.string().optional(),
        attributes: z.record(z.string()).optional(),
      })
      .optional()
      .describe('Search for specific elements and include them in the report'),
    includePerformanceMetrics: z
      .boolean()
      .optional()
      .default(false)
      .describe('Include performance metrics in the report'),
    includeAccessibilityInfo: z
      .boolean()
      .optional()
      .default(false)
      .describe('Include accessibility information'),
    includeTroubleshootingSuggestions: z
      .boolean()
      .optional()
      .default(false)
      .describe('Include troubleshooting suggestions'),
    diagnosticLevel: z
      .enum(['none', 'basic', 'standard', 'detailed', 'full'])
      .optional()
      .default('standard')
      .describe(
        'Level of diagnostic detail: none (no diagnostics), basic (critical only), standard (default), detailed (with metrics), full (all info)'
      ),
    useParallelAnalysis: z
      .boolean()
      .optional()
      .default(false)
      .describe(
        'Use Phase 2 parallel analysis for improved performance and resource monitoring'
      ),
    useUnifiedSystem: z
      .boolean()
      .optional()
      .default(true)
      .describe(
        'Use Phase 3 unified diagnostic system with enhanced error handling and monitoring'
      ),
    configOverrides: z
      .object({
        enableResourceMonitoring: z.boolean().optional(),
        enableErrorEnrichment: z.boolean().optional(),
        enableAdaptiveThresholds: z.boolean().optional(),
        performanceThresholds: z
          .object({
            pageAnalysis: z.number().optional(),
            elementDiscovery: z.number().optional(),
            resourceMonitoring: z.number().optional(),
          })
          .optional(),
      })
      .optional()
      .describe('Runtime configuration overrides for diagnostic system'),
    includeSystemStats: z
      .boolean()
      .optional()
      .default(false)
      .describe('Include unified system statistics and health information'),
    expectation: expectationSchema.optional(),
  })
  .describe('Generate a comprehensive diagnostic report of the current page');

export const browserDiagnose = defineTabTool({
  capability: 'core',
  schema: {
    name: 'browser_diagnose',
    title: 'Diagnose page',
    type: 'readOnly',
    description:
      'Analyze page complexity and performance characteristics. Reports on: iframe count, DOM size, modal states, element statistics. Use for: debugging slow pages, understanding page structure, or monitoring page complexity.',
    inputSchema: diagnoseSchema,
  },
  handle: async (tab, params, response) => {
    const {
      searchForElements,
      includePerformanceMetrics = false,
      includeAccessibilityInfo = false,
      includeTroubleshootingSuggestions = false,
      diagnosticLevel = 'standard',
      useParallelAnalysis = false,
      useUnifiedSystem = true,
      configOverrides,
      includeSystemStats = false,
    } = params;

    try {
      if (diagnosticLevel === 'none') {
        response.addResult('Diagnostics disabled (level: none)');
        return;
      }

      const startTime = Date.now();
      const configHandler = new DiagnoseConfigHandler();

      // Validate configuration
      const configDiagnostics = configHandler.validateConfiguration();
      if (diagnosticLevel === 'full' && includeSystemStats) {
        response.addResult(
          `## Configuration Status\n- **Thresholds Status**: ${configDiagnostics.status}\n- **Customizations**: ${configDiagnostics.customizations.length} active\n- **Warnings**: ${configDiagnostics.warnings.length} items\n\n`
        );
      }

      if (configDiagnostics.status === 'failed') {
        response.addError(
          'Configuration system validation failed - using fallback settings'
        );
      }

      // Initialize systems
      const systemConfig = configHandler.initializeSystems(
        tab,
        useUnifiedSystem,
        useParallelAnalysis,
        configOverrides as ConfigOverrides
      );

      try {
        // Run analysis
        const analysisRunner = new DiagnoseAnalysisRunner();
        const analysisResult = await analysisRunner.runAnalysis(
          systemConfig.unifiedSystem || null,
          systemConfig.pageAnalyzer || null,
          useParallelAnalysis,
          includeSystemStats
        );

        // Build report
        const reportBuilder = new DiagnoseReportBuilder(tab);
        const reportOptions = {
          diagnosticLevel: diagnosticLevel as
            | 'none'
            | 'basic'
            | 'standard'
            | 'detailed'
            | 'full',
          includePerformanceMetrics,
          includeAccessibilityInfo,
          includeTroubleshootingSuggestions,
          includeSystemStats,
          searchForElements: searchForElements as SearchCriteria | undefined,
          appliedOverrides: systemConfig.appliedOverrides,
          startTime,
        };

        const report = await reportBuilder.buildReport(
          analysisResult,
          systemConfig.unifiedSystem || null,
          systemConfig.pageAnalyzer || null,
          reportOptions
        );

        response.addResult(report);
      } finally {
        // Cleanup: unified system manages its own lifecycle, only dispose legacy pageAnalyzer
        if (!systemConfig.unifiedSystem && systemConfig.pageAnalyzer) {
          await systemConfig.pageAnalyzer.dispose();
        }
      }
    } catch (error) {
      response.addError(
        `Error generating diagnostic report: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  },
});
