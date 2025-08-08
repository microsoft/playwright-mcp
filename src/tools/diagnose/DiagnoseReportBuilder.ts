/**
 * Builds diagnostic reports for the diagnose tool
 */

import { ElementDiscovery } from '../../diagnostics/element-discovery.js';
import type {
  PageAnalyzer,
  PageStructureAnalysis,
} from '../../diagnostics/page-analyzer.js';
import type { UnifiedDiagnosticSystem } from '../../diagnostics/unified-system.js';
import type { Tab } from '../../tab.js';
import { getErrorMessage } from '../../utils/commonFormatters.js';
import {
  ArrayBuilder,
  addDomComplexityMetrics,
  addErrorSection,
  addInteractionMetrics,
  addModalStatesIfPresent,
  addResourceMetrics,
  addSystemHealthSection,
} from '../../utils/diagnosticReportUtils.js';
import { DiagnosticReportBuilder } from '../../utils/reportBuilder.js';
import type { AnalysisResult } from './DiagnoseAnalysisRunner.js';

interface PerformanceDeviation {
  percent: number;
  significance: 'significant' | 'notable' | 'minimal' | 'normal';
}

interface PerformanceBaseline {
  expectedExecutionTimes: Record<string, number>;
  actualAverages: Record<string, number>;
  deviations: Record<string, PerformanceDeviation>;
}

interface ConfigReport {
  configurationStatus: string;
  performanceBaseline: PerformanceBaseline;
  appliedOverrides: Array<{
    category: string;
    impact: string;
    changes: string[];
  }>;
  recommendations: Array<{
    priority: string;
    message: string;
    type: string;
  }>;
}

interface PageMetrics {
  domMetrics?: {
    totalElements: number;
    maxDepth: number;
    largeSubtrees: Array<{
      selector: string;
      elementCount: number;
      description: string;
    }>;
  };
  interactionMetrics?: {
    clickableElements: number;
    formElements: number;
    iframes: number;
    disabledElements: number;
  };
  resourceMetrics?: {
    totalRequests: number;
    totalSize: number;
    loadTime: number;
    imageCount: number;
    estimatedImageSize: string;
    scriptTags: number;
    externalScripts: number;
    inlineScripts: number;
    stylesheetCount: number;
  };
  layoutMetrics?: {
    viewportWidth: number;
    viewportHeight: number;
    scrollHeight: number;
    fixedElements: Array<{
      selector: string;
      purpose: string;
      zIndex: number;
    }>;
    highZIndexElements: Array<{
      selector: string;
      zIndex: number;
      description: string;
    }>;
    overflowHiddenElements: number;
  };
  warnings?: Array<{
    level: string;
    type: string;
    message: string;
  }>;
}

export interface SearchCriteria {
  text?: string;
  role?: string;
  tagName?: string;
  attributes?: Record<string, string>;
}

export interface ReportOptions {
  diagnosticLevel: 'none' | 'basic' | 'standard' | 'detailed' | 'full';
  includePerformanceMetrics: boolean;
  includeAccessibilityInfo: boolean;
  includeTroubleshootingSuggestions: boolean;
  includeSystemStats: boolean;
  searchForElements?: SearchCriteria;
  appliedOverrides?: string[];
  startTime: number;
}

export class DiagnoseReportBuilder {
  private reportBuilder: DiagnosticReportBuilder;
  private readonly tab: Tab;

  constructor(tab: Tab) {
    this.tab = tab;
    this.reportBuilder = new DiagnosticReportBuilder();
  }

  async buildReport(
    analysisResult: AnalysisResult,
    unifiedSystem: UnifiedDiagnosticSystem | null,
    pageAnalyzer: PageAnalyzer | null,
    options: ReportOptions
  ): Promise<string> {
    this.reportBuilder.clear();

    if (options.diagnosticLevel === 'none') {
      return 'Diagnostics disabled (level: none)';
    }

    this.addReportHeader(analysisResult, unifiedSystem, options);
    await this.addPageStructureSection(analysisResult.diagnosticInfo, options);
    this.addModalStatesSection(analysisResult.diagnosticInfo);
    await this.addElementSearchSection(options);
    await this.addPerformanceSection(
      analysisResult,
      unifiedSystem,
      pageAnalyzer,
      options
    );
    await this.addAccessibilitySection(analysisResult.diagnosticInfo, options);
    this.addTroubleshootingSection(analysisResult.diagnosticInfo, options);

    return this.reportBuilder.build();
  }

  private addReportHeader(
    analysisResult: AnalysisResult,
    unifiedSystem: UnifiedDiagnosticSystem | null,
    options: ReportOptions
  ): void {
    if (unifiedSystem) {
      this.reportBuilder
        .addHeader('Unified Diagnostic System Report', 1)
        .addKeyValue(
          'Unified System Status',
          'Active with enhanced error handling and monitoring'
        )
        .addKeyValue(
          'Configuration',
          options.appliedOverrides?.length
            ? 'Custom overrides applied'
            : 'Default settings'
        )
        .addEmptyLine();

      if (options.appliedOverrides?.length) {
        this.reportBuilder.addSection(
          'Applied Configuration Overrides',
          (builder) => {
            if (options.appliedOverrides) {
              for (const override of options.appliedOverrides) {
                builder.addListItem(`**${override}**`);
              }
            }
          }
        );
      }

      this.reportBuilder
        .addKeyValue('Analysis Type', analysisResult.analysisType)
        .addKeyValue('Analysis Status', analysisResult.analysisStatus);

      if (analysisResult.errors?.length) {
        this.reportBuilder.addSection('Analysis Warnings', (builder) => {
          if (analysisResult.errors) {
            for (const error of analysisResult.errors) {
              builder.addListItem(`**${error}**`);
            }
          }
        });
      }

      this.addSystemHealthSection(analysisResult, unifiedSystem, options);
    }
  }

  private addSystemHealthSection(
    analysisResult: AnalysisResult,
    unifiedSystem: UnifiedDiagnosticSystem,
    options: ReportOptions
  ): void {
    if (!(options.includeSystemStats && analysisResult.systemHealthInfo)) {
      return;
    }

    const systemHealthInfo = analysisResult.systemHealthInfo;

    const systemStats = unifiedSystem.getSystemStats();

    addSystemHealthSection(this.reportBuilder, {
      status: systemHealthInfo.status,
      totalOperations: systemStats.performanceMetrics.totalOperations,
      successRate: systemStats.performanceMetrics.successRate,
      activeHandles: systemStats.resourceUsage.currentHandles,
      totalErrors: Object.values(systemStats.errorCount).reduce(
        (sum, count) => sum + count,
        0
      ),
    });

    this.addConfigurationImpactSection(unifiedSystem, options);
    this.addSystemIssuesAndRecommendations(systemHealthInfo);
  }

  private addConfigurationImpactSection(
    unifiedSystem: UnifiedDiagnosticSystem,
    options: ReportOptions
  ): void {
    if (!options.appliedOverrides?.length) {
      return;
    }

    const configReport = unifiedSystem.getConfigurationReport();

    this.reportBuilder.addSection(
      'Configuration Impact Analysis',
      (builder) => {
        builder.addKeyValue(
          'Configuration Status',
          configReport.configurationStatus
            .replace('-', ' ')
            .replace(/\b\w/g, (l) => l.toUpperCase())
        );
      },
      3
    );

    this.addPerformanceBaselineComparison(configReport);
    this.addAppliedOverridesDetails(configReport);
    this.addHighPriorityRecommendations(configReport);
  }

  private addPerformanceBaselineComparison(configReport: ConfigReport): void {
    const { expectedExecutionTimes, actualAverages, deviations } =
      configReport.performanceBaseline;
    const hasActualData = Object.values(actualAverages).some(
      (val: number) => val > 0
    );

    if (!hasActualData) {
      return;
    }

    this.reportBuilder.addEmptyLine();
    this.reportBuilder.addLine('**Performance Baseline Comparison:**');
    for (const component of Object.keys(expectedExecutionTimes)) {
      const expected =
        expectedExecutionTimes[
          component as keyof typeof expectedExecutionTimes
        ];
      const actual = actualAverages[component as keyof typeof actualAverages];
      const deviation = deviations[component];

      if (actual > 0) {
        const performanceIndicator = this.getPerformanceIndicator(deviation);
        const deviationText = deviation
          ? ` (${deviation.percent > 0 ? '+' : ''}${deviation.percent}% ${deviation.significance})`
          : '';

        this.reportBuilder.addLine(
          `  ${performanceIndicator} **${component}**: Expected ${expected}ms, Actual ${actual.toFixed(0)}ms${deviationText}`
        );
      }
    }
  }

  private getPerformanceIndicator(
    deviation: PerformanceDeviation | null
  ): string {
    if (!deviation) {
      return '⚪';
    }

    switch (deviation.significance) {
      case 'significant':
        return '🔴';
      case 'notable':
        return '🟡';
      default:
        return '🟢';
    }
  }

  private addAppliedOverridesDetails(configReport: ConfigReport): void {
    if (configReport.appliedOverrides.length === 0) {
      return;
    }

    this.reportBuilder.addEmptyLine();
    this.reportBuilder.addLine('**Applied Configuration Changes:**');
    for (const override of configReport.appliedOverrides) {
      const impactIcon = this.getImpactIcon(override.impact);
      this.reportBuilder.addLine(
        `  ${impactIcon} **${override.category}** (${override.impact} impact):`
      );
      for (const change of override.changes) {
        this.reportBuilder.addLine(`    - ${change}`);
      }
    }
  }

  private getImpactIcon(impact: string): string {
    switch (impact) {
      case 'high':
        return '🔴';
      case 'medium':
        return '🟡';
      default:
        return '🟢';
    }
  }

  private addHighPriorityRecommendations(configReport: ConfigReport): void {
    const highPriorityRecs = configReport.recommendations.filter(
      (r) => r.priority === 'high'
    );

    if (highPriorityRecs.length === 0) {
      return;
    }

    this.reportBuilder.addEmptyLine();
    this.reportBuilder.addLine('**High Priority Recommendations:**');
    for (const rec of highPriorityRecs) {
      const typeIcon = this.getRecommendationTypeIcon(rec.type);
      this.reportBuilder.addLine(`  ${typeIcon} ${rec.message}`);
    }
  }

  private getRecommendationTypeIcon(type: string): string {
    switch (type) {
      case 'warning':
        return '⚠️';
      case 'optimization':
        return '⚡';
      default:
        return 'ℹ️';
    }
  }

  private addSystemIssuesAndRecommendations(
    systemHealthInfo: NonNullable<AnalysisResult['systemHealthInfo']>
  ): void {
    if (systemHealthInfo.issues.length > 0) {
      this.reportBuilder.addEmptyLine();
      this.reportBuilder.addHeader('System Issues', 3);
      for (const issue of systemHealthInfo.issues) {
        this.reportBuilder.addListItem(`⚠️ ${issue}`);
      }
    }

    if (systemHealthInfo.recommendations.length > 0) {
      this.reportBuilder.addEmptyLine();
      this.reportBuilder.addHeader('System Recommendations', 3);
      for (const rec of systemHealthInfo.recommendations) {
        this.reportBuilder.addListItem(`💡 ${rec}`);
      }
    }

    this.reportBuilder.addEmptyLine();
  }

  private async addPageStructureSection(
    diagnosticInfo: PageStructureAnalysis,
    options: ReportOptions
  ): Promise<void> {
    if (options.diagnosticLevel === 'basic') {
      this.reportBuilder
        .addHeader('Basic Diagnostic Report', 1)
        .addKeyValue('URL', this.tab.page.url())
        .addEmptyLine()
        .addHeader('Critical Information', 2);

      if (diagnosticInfo.iframes.detected) {
        this.reportBuilder.addKeyValue(
          'IFrames detected',
          diagnosticInfo.iframes.count
        );
      }

      if (diagnosticInfo.modalStates.blockedBy.length > 0) {
        this.reportBuilder.addKeyValue(
          'Active modals',
          diagnosticInfo.modalStates.blockedBy.join(', ')
        );
      }

      this.reportBuilder
        .addKeyValue(
          'Interactable elements',
          diagnosticInfo.elements.totalInteractable
        )
        .addEmptyLine();
    } else {
      this.reportBuilder
        .addHeader('Page Diagnostic Report', 1)
        .addKeyValue('URL', this.tab.page.url())
        .addKeyValue('Title', await this.tab.page.title())
        .addEmptyLine()
        .addHeader('Page Structure Analysis', 2)
        .addKeyValue(
          'IFrames',
          `${diagnosticInfo.iframes.count} iframes detected: ${diagnosticInfo.iframes.detected}`
        )
        .addKeyValue(
          'Accessible iframes',
          diagnosticInfo.iframes.accessible.length
        )
        .addKeyValue(
          'Inaccessible iframes',
          diagnosticInfo.iframes.inaccessible.length
        )
        .addEmptyLine()
        .addKeyValue(
          'Total visible elements',
          diagnosticInfo.elements.totalVisible
        )
        .addKeyValue(
          'Total interactable elements',
          diagnosticInfo.elements.totalInteractable
        )
        .addKeyValue(
          'Elements missing ARIA',
          diagnosticInfo.elements.missingAria
        )
        .addEmptyLine();
    }
  }

  private addModalStatesSection(diagnosticInfo: PageStructureAnalysis): void {
    addModalStatesIfPresent(this.reportBuilder, diagnosticInfo.modalStates);
  }

  private async addElementSearchSection(options: ReportOptions): Promise<void> {
    if (!options.searchForElements || options.diagnosticLevel === 'basic') {
      return;
    }

    const elementDiscovery = new ElementDiscovery(this.tab.page);
    const foundElements = await elementDiscovery.findAlternativeElements({
      originalSelector: '',
      searchCriteria: options.searchForElements,
      maxResults: 10,
    });

    this.reportBuilder.addHeader('Element Search Results', 2);
    if (foundElements.length === 0) {
      this.reportBuilder.addListItem(
        'No elements found matching the search criteria'
      );
    } else {
      this.reportBuilder.addLine(
        `Found ${foundElements.length} matching elements:`
      );
      for (const [index, element] of foundElements.entries()) {
        this.reportBuilder.addLine(
          `${index + 1}. **${element.selector}** (${(element.confidence * 100).toFixed(0)}% confidence)`
        );
        this.reportBuilder.addLine(`   - ${element.reason}`);
      }
    }
    this.reportBuilder.addEmptyLine();
  }

  private async addPerformanceSection(
    analysisResult: AnalysisResult,
    unifiedSystem: UnifiedDiagnosticSystem | null,
    pageAnalyzer: PageAnalyzer | null,
    options: ReportOptions
  ): Promise<void> {
    const shouldIncludeMetrics =
      (options.includePerformanceMetrics ||
        options.diagnosticLevel === 'detailed' ||
        options.diagnosticLevel === 'full') &&
      options.diagnosticLevel !== 'basic';

    if (!shouldIncludeMetrics) {
      return;
    }

    const diagnosisTime = Date.now() - options.startTime;

    this.reportBuilder
      .addHeader('Performance Metrics', 2)
      .addKeyValue('Diagnosis execution time', `${diagnosisTime}ms`);

    try {
      const comprehensiveMetrics = await this.getComprehensiveMetrics(
        analysisResult,
        unifiedSystem,
        pageAnalyzer
      );

      addDomComplexityMetrics(this.reportBuilder, comprehensiveMetrics);
      addInteractionMetrics(this.reportBuilder, comprehensiveMetrics);
      addResourceMetrics(this.reportBuilder, comprehensiveMetrics);

      if (options.diagnosticLevel === 'full') {
        this.addLayoutMetrics(comprehensiveMetrics);
      }

      this.addPerformanceWarnings(comprehensiveMetrics);
    } catch (error) {
      addErrorSection(
        this.reportBuilder,
        error,
        'analyzing performance metrics'
      );
    }

    await this.addBrowserPerformanceMetrics();
    this.reportBuilder.addEmptyLine();
  }

  private async getComprehensiveMetrics(
    analysisResult: AnalysisResult,
    unifiedSystem: UnifiedDiagnosticSystem | null,
    pageAnalyzer: PageAnalyzer | null
  ): Promise<PageMetrics> {
    if (analysisResult.performanceMetrics) {
      return analysisResult.performanceMetrics;
    }

    if (pageAnalyzer) {
      return await pageAnalyzer.analyzePerformanceMetrics();
    }

    if (unifiedSystem) {
      const perfResult = await unifiedSystem.analyzePerformanceMetrics();
      if (perfResult.success) {
        return perfResult.data as PageMetrics;
      }
      throw new Error(
        `Performance metrics analysis failed: ${getErrorMessage(perfResult.error)}`
      );
    }

    throw new Error('No performance analyzer available');
  }

  private addLayoutMetrics(metrics: PageMetrics): void {
    this.reportBuilder
      .addEmptyLine()
      .addHeader('Layout Analysis', 3)
      .addKeyValue(
        'Fixed position elements',
        metrics?.layoutMetrics?.fixedElements?.length || 0
      )
      .addKeyValue(
        'High z-index elements',
        metrics?.layoutMetrics?.highZIndexElements?.length || 0
      )
      .addKeyValue(
        'Overflow hidden elements',
        metrics?.layoutMetrics?.overflowHiddenElements || 0
      );

    if (
      metrics?.layoutMetrics?.fixedElements?.length &&
      metrics.layoutMetrics.fixedElements.length > 0
    ) {
      this.reportBuilder.addEmptyLine().addLine('**Fixed Elements:**');
      for (const [index, element] of metrics.layoutMetrics.fixedElements
        .slice(0, 5)
        .entries()) {
        this.reportBuilder.addLine(
          `${index + 1}. **${element.selector}**: ${element.purpose} (z-index: ${element.zIndex})`
        );
      }
    }

    if (
      metrics?.layoutMetrics?.highZIndexElements?.length &&
      metrics.layoutMetrics.highZIndexElements.length > 0
    ) {
      this.reportBuilder.addEmptyLine().addLine('**High Z-Index Elements:**');
      for (const [index, element] of metrics.layoutMetrics.highZIndexElements
        .slice(0, 5)
        .entries()) {
        this.reportBuilder.addLine(
          `${index + 1}. **${element.selector}**: z-index ${element.zIndex} (${element.description})`
        );
      }
    }
  }

  private addPerformanceWarnings(metrics: PageMetrics): void {
    if (metrics?.warnings?.length && metrics.warnings.length > 0) {
      this.reportBuilder.addEmptyLine().addHeader('Performance Warnings', 3);
      for (const warning of metrics.warnings) {
        const icon = warning.level === 'danger' ? '🚨' : '⚠️';
        this.reportBuilder.addListItem(
          `${icon} **${warning.type}**: ${warning.message}`
        );
      }
    }
  }

  private async addBrowserPerformanceMetrics(): Promise<void> {
    try {
      const browserMetrics = await this.tab.page.evaluate(() => {
        const navigation = performance.getEntriesByType(
          'navigation'
        )[0] as PerformanceNavigationTiming;
        const paint = performance.getEntriesByType('paint');

        return {
          domContentLoaded:
            navigation?.domContentLoadedEventEnd -
            navigation?.domContentLoadedEventStart,
          loadComplete: navigation?.loadEventEnd - navigation?.loadEventStart,
          firstPaint: paint.find((p) => p.name === 'first-paint')?.startTime,
          firstContentfulPaint: paint.find(
            (p) => p.name === 'first-contentful-paint'
          )?.startTime,
        };
      });

      if (
        browserMetrics.domContentLoaded ||
        browserMetrics.loadComplete ||
        browserMetrics.firstPaint ||
        browserMetrics.firstContentfulPaint
      ) {
        this.reportBuilder
          .addEmptyLine()
          .addHeader('Browser Performance Timing', 3);

        if (browserMetrics.domContentLoaded) {
          this.reportBuilder.addKeyValue(
            'DOM Content Loaded',
            `${browserMetrics.domContentLoaded.toFixed(2)}ms`
          );
        }
        if (browserMetrics.loadComplete) {
          this.reportBuilder.addKeyValue(
            'Load Complete',
            `${browserMetrics.loadComplete.toFixed(2)}ms`
          );
        }
        if (browserMetrics.firstPaint) {
          this.reportBuilder.addKeyValue(
            'First Paint',
            `${browserMetrics.firstPaint.toFixed(2)}ms`
          );
        }
        if (browserMetrics.firstContentfulPaint) {
          this.reportBuilder.addKeyValue(
            'First Contentful Paint',
            `${browserMetrics.firstContentfulPaint.toFixed(2)}ms`
          );
        }
      }
    } catch (error) {
      addErrorSection(
        this.reportBuilder,
        error,
        'retrieving browser timing metrics'
      );
    }
  }

  private async addAccessibilitySection(
    diagnosticInfo: PageStructureAnalysis,
    options: ReportOptions
  ): Promise<void> {
    const shouldIncludeA11y =
      (options.includeAccessibilityInfo ||
        options.diagnosticLevel === 'full') &&
      options.diagnosticLevel !== 'basic';

    if (!shouldIncludeA11y) {
      return;
    }

    this.reportBuilder
      .addHeader('Accessibility Information', 2)
      .addKeyValue(
        'Elements with missing ARIA labels',
        diagnosticInfo.elements.missingAria
      );

    const a11yMetrics = await this.tab.page.evaluate(() => {
      const headings = document.querySelectorAll(
        'h1, h2, h3, h4, h5, h6'
      ).length;
      const landmarks = document.querySelectorAll(
        '[role="main"], [role="navigation"], [role="banner"], [role="contentinfo"], main, nav, header, footer'
      ).length;
      const altTexts = document.querySelectorAll('img[alt]').length;
      const totalImages = document.querySelectorAll('img').length;

      return { headings, landmarks, imagesWithAlt: altTexts, totalImages };
    });

    this.reportBuilder
      .addKeyValue('Heading elements', a11yMetrics.headings)
      .addKeyValue('Landmark elements', a11yMetrics.landmarks)
      .addKeyValue(
        'Images with alt text',
        `${a11yMetrics.imagesWithAlt}/${a11yMetrics.totalImages}`
      )
      .addEmptyLine();
  }

  private addTroubleshootingSection(
    diagnosticInfo: PageStructureAnalysis,
    options: ReportOptions
  ): void {
    const shouldIncludeTroubleshooting =
      (options.includeTroubleshootingSuggestions ||
        options.diagnosticLevel === 'standard' ||
        options.diagnosticLevel === 'detailed' ||
        options.diagnosticLevel === 'full') &&
      options.diagnosticLevel !== 'basic';

    if (!shouldIncludeTroubleshooting) {
      return;
    }

    this.reportBuilder.addHeader('Troubleshooting Suggestions', 2);

    const suggestions = new ArrayBuilder<string>()
      .addIf(
        diagnosticInfo.iframes.detected,
        'Elements might be inside iframes - use frameLocator() for iframe interactions'
      )
      .addIf(
        diagnosticInfo.modalStates.blockedBy.length > 0,
        `Active modal states (${diagnosticInfo.modalStates.blockedBy.join(', ')}) may block interactions`
      )
      .addIf(
        diagnosticInfo.elements.missingAria > 0,
        `${diagnosticInfo.elements.missingAria} elements lack proper ARIA attributes - consider using text-based selectors`
      )
      .addIf(
        diagnosticInfo.elements.totalInteractable <
          diagnosticInfo.elements.totalVisible * 0.1,
        'Low ratio of interactable elements - page might still be loading or have CSS issues'
      )
      .build();

    const finalSuggestions =
      suggestions.length === 0
        ? [
            'No obvious issues detected - page appears to be in good state for automation',
          ]
        : suggestions;

    for (const suggestion of finalSuggestions) {
      this.reportBuilder.addListItem(suggestion);
    }
    this.reportBuilder.addEmptyLine();
  }
}
