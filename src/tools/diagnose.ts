/**
 * browser_diagnose tool - Comprehensive page diagnostic information
 */

import { z } from 'zod';
import type { Response } from '../response.js';
import { expectationSchema } from '../schemas/expectation.js';
import type { Tab } from '../tab.js';
import { createErrorReporter } from '../utils/errorHandlerMiddleware.js';
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
    const config = extractDiagnoseConfig(params);

    try {
      if (config.diagnosticLevel === 'none') {
        response.addResult('Diagnostics disabled (level: none)');
        return;
      }

      const startTime = Date.now();
      await executeDiagnoseProcess(tab, config, response, startTime);
    } catch (error) {
      await handleDiagnoseError(error, response);
    }
  },
});

function extractDiagnoseConfig(params: any) {
  return {
    searchForElements: params.searchForElements,
    includePerformanceMetrics: params.includePerformanceMetrics ?? false,
    includeAccessibilityInfo: params.includeAccessibilityInfo ?? false,
    includeTroubleshootingSuggestions:
      params.includeTroubleshootingSuggestions ?? false,
    diagnosticLevel: params.diagnosticLevel ?? 'standard',
    useParallelAnalysis: params.useParallelAnalysis ?? false,
    useUnifiedSystem: params.useUnifiedSystem ?? true,
    configOverrides: params.configOverrides,
    includeSystemStats: params.includeSystemStats ?? false,
  };
}

async function executeDiagnoseProcess(
  tab: Tab,
  config: ReturnType<typeof extractDiagnoseConfig>,
  response: Response,
  startTime: number
) {
  const configHandler = new DiagnoseConfigHandler();

  // Validate and setup configuration
  const _configDiagnostics = validateAndSetupConfig(
    configHandler,
    config,
    response
  );

  // Initialize systems
  const systemConfig = configHandler.initializeSystems(
    tab,
    config.useUnifiedSystem,
    config.useParallelAnalysis,
    config.configOverrides as ConfigOverrides
  );

  try {
    // Run analysis and build report
    const report = await runAnalysisAndBuildReport(
      tab,
      systemConfig,
      config,
      startTime
    );
    response.addResult(report);
  } finally {
    await cleanupSystems(systemConfig);
  }
}

function validateAndSetupConfig(
  configHandler: DiagnoseConfigHandler,
  config: ReturnType<typeof extractDiagnoseConfig>,
  response: Response
) {
  const configDiagnostics = configHandler.validateConfiguration();

  if (config.diagnosticLevel === 'full' && config.includeSystemStats) {
    response.addResult(
      `## Configuration Status\n- **Thresholds Status**: ${configDiagnostics.status}\n- **Customizations**: ${configDiagnostics.customizations.length} active\n- **Warnings**: ${configDiagnostics.warnings.length} items\n\n`
    );
  }

  if (configDiagnostics.status === 'failed') {
    response.addError(
      'Configuration system validation failed - using fallback settings'
    );
  }

  return configDiagnostics;
}

async function runAnalysisAndBuildReport(
  tab: Tab,
  systemConfig: any,
  config: ReturnType<typeof extractDiagnoseConfig>,
  startTime: number
) {
  // Run analysis
  const analysisRunner = new DiagnoseAnalysisRunner();
  const analysisResult = await analysisRunner.runAnalysis(
    systemConfig.unifiedSystem ?? null,
    systemConfig.pageAnalyzer ?? null,
    config.useParallelAnalysis,
    config.includeSystemStats
  );

  // Build report
  const reportBuilder = new DiagnoseReportBuilder(tab);
  const reportOptions = {
    diagnosticLevel: config.diagnosticLevel as
      | 'none'
      | 'basic'
      | 'standard'
      | 'detailed'
      | 'full',
    includePerformanceMetrics: config.includePerformanceMetrics,
    includeAccessibilityInfo: config.includeAccessibilityInfo,
    includeTroubleshootingSuggestions: config.includeTroubleshootingSuggestions,
    includeSystemStats: config.includeSystemStats,
    searchForElements: config.searchForElements as SearchCriteria | undefined,
    appliedOverrides: systemConfig.appliedOverrides,
    startTime,
  };

  return await reportBuilder.buildReport(
    analysisResult,
    systemConfig.unifiedSystem ?? null,
    systemConfig.pageAnalyzer ?? null,
    reportOptions
  );
}

async function cleanupSystems(systemConfig: any) {
  // Cleanup: unified system manages its own lifecycle, only dispose legacy pageAnalyzer
  if (!systemConfig.unifiedSystem && systemConfig.pageAnalyzer) {
    await systemConfig.pageAnalyzer.dispose();
  }
}

function handleDiagnoseError(error: unknown, response: Response) {
  const errorReporter = createErrorReporter('Diagnose');
  try {
    errorReporter.reportAndThrow(error, 'generateDiagnosticReport');
  } catch (enrichedError) {
    response.addError(
      enrichedError instanceof Error
        ? enrichedError.message
        : String(enrichedError)
    );
  }
}
