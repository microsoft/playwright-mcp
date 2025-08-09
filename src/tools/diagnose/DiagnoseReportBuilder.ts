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
import { ArrayBuilder } from '../../utils/codeDeduplicationUtils.js';
import {
  formatPerformanceComparison,
  formatStatusString,
  getErrorMessage,
  processBrowserMetrics,
} from '../../utils/commonFormatters.js';
import {
  addDomComplexityMetrics,
  addElementList as addElementListUtil,
  addErrorSection,
  addInteractionMetrics,
  addKeyValuePairs as addKeyValuePairsUtil,
  addModalStatesIfPresent,
  addOptionalListSection as addOptionalListSectionUtil,
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
  private readonly reportBuilder: DiagnosticReportBuilder;
  private readonly tab: Tab;

  constructor(tab: Tab) {
    this.tab = tab;
    this.reportBuilder = new DiagnosticReportBuilder();
  }

  private addKeyValuePairs(
    pairs: [string, string | number][],
    headerText?: string,
    subHeaderText?: string,
    headerLevel = 2
  ): void {
    if (headerText) {
      this.reportBuilder.addHeader(headerText, 1).addEmptyLine();
    }
    if (subHeaderText) {
      this.reportBuilder.addHeader(subHeaderText, headerLevel);
    }

    // Use existing utility from diagnosticReportUtils
    addKeyValuePairsUtil(
      this.reportBuilder,
      pairs.map(([key, value]) => ({ key, value }))
    );

    this.reportBuilder.addEmptyLine();
  }

  private addOptionalListSection<T>(
    title: string,
    items: T[] | undefined,
    formatter: (item: T) => string,
    headerLevel = 2
  ): void {
    addOptionalListSectionUtil(
      this.reportBuilder,
      title,
      items,
      formatter,
      headerLevel
    );
  }

  private shouldIncludeSection(
    options: ReportOptions,
    section: 'accessibility' | 'performance' | 'troubleshooting'
  ): boolean {
    const sectionConfig = {
      accessibility:
        options.includeAccessibilityInfo || options.diagnosticLevel === 'full',
      performance:
        options.includePerformanceMetrics ||
        options.diagnosticLevel === 'detailed' ||
        options.diagnosticLevel === 'full',
      troubleshooting:
        options.includeTroubleshootingSuggestions ||
        ['standard', 'detailed', 'full'].includes(options.diagnosticLevel),
    };

    return sectionConfig[section] && options.diagnosticLevel !== 'basic';
  }

  private addElementList<T>(
    title: string,
    elements: T[] | undefined,
    formatter: (element: T, index: number) => string,
    maxItems = 5
  ): void {
    addElementListUtil(
      this.reportBuilder,
      title,
      elements,
      formatter,
      maxItems
    );
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
      this.addKeyValuePairs(
        [
          [
            'Unified System Status',
            'Active with enhanced error handling and monitoring',
          ],
          [
            'Configuration',
            options.appliedOverrides?.length
              ? 'Custom overrides applied'
              : 'Default settings',
          ],
          ['Analysis Type', analysisResult.analysisType],
          ['Analysis Status', analysisResult.analysisStatus],
        ],
        'Unified Diagnostic System Report'
      );

      this.addOptionalListSection(
        'Applied Configuration Overrides',
        options.appliedOverrides,
        (item) => `**${item}**`
      );
      this.addOptionalListSection(
        'Analysis Warnings',
        analysisResult.errors,
        (item) => `**${item}**`
      );

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

    this.reportBuilder
      .addEmptyLine()
      .addLine('**Performance Baseline Comparison:**');

    for (const component of Object.keys(expectedExecutionTimes)) {
      const expected = expectedExecutionTimes[component];
      const actual = actualAverages[component];
      const deviation = deviations[component];

      if (actual > 0) {
        this.reportBuilder.addLine(
          formatPerformanceComparison(component, expected, actual, deviation)
        );
      }
    }
  }

  private addAppliedOverridesDetails(configReport: ConfigReport): void {
    if (configReport.appliedOverrides.length === 0) {
      return;
    }

    this.reportBuilder
      .addEmptyLine()
      .addLine('**Applied Configuration Changes:**');

    for (const override of configReport.appliedOverrides) {
      this.reportBuilder.addLine(
        formatStatusString(
          `**${override.category}**`,
          override.impact,
          'impact',
          `(${override.impact} impact):`
        )
      );

      for (const change of override.changes) {
        this.reportBuilder.addLine(`    - ${change}`);
      }
    }
  }

  private addHighPriorityRecommendations(configReport: ConfigReport): void {
    const highPriorityRecs = configReport.recommendations.filter(
      (r) => r.priority === 'high'
    );
    if (highPriorityRecs.length === 0) {
      return;
    }

    this.reportBuilder
      .addEmptyLine()
      .addLine('**High Priority Recommendations:**');

    for (const rec of highPriorityRecs) {
      this.reportBuilder.addLine(
        formatStatusString(rec.message, rec.type, 'recommendation')
      );
    }
  }

  private addSystemIssuesAndRecommendations(
    systemHealthInfo: NonNullable<AnalysisResult['systemHealthInfo']>
  ): void {
    this.addOptionalListSection(
      'System Issues',
      systemHealthInfo.issues,
      (item) => `⚠️ ${item}`,
      3
    );
    this.addOptionalListSection(
      'System Recommendations',
      systemHealthInfo.recommendations,
      (item) => `💡 ${item}`,
      3
    );
    this.reportBuilder.addEmptyLine();
  }

  private async addPageStructureSection(
    diagnosticInfo: PageStructureAnalysis,
    options: ReportOptions
  ): Promise<void> {
    const isBasic = options.diagnosticLevel === 'basic';
    const title = isBasic
      ? 'Basic Diagnostic Report'
      : 'Page Diagnostic Report';
    const url = this.tab.page.url();

    const basicKeyValues: [string, string | number][] = [['URL', url]];

    if (!isBasic) {
      basicKeyValues.push(['Title', await this.tab.page.title()]);
    }

    this.addKeyValuePairs(basicKeyValues, title);

    if (isBasic) {
      this.addBasicDiagnosticInfo(diagnosticInfo);
    } else {
      this.addDetailedPageStructure(diagnosticInfo);
    }
  }

  private addBasicDiagnosticInfo(diagnosticInfo: PageStructureAnalysis): void {
    this.reportBuilder.addHeader('Critical Information', 2);

    const criticalInfo: [string, string | number, boolean][] = [
      [
        'IFrames detected',
        diagnosticInfo.iframes.count,
        diagnosticInfo.iframes.detected,
      ],
      [
        'Active modals',
        diagnosticInfo.modalStates.blockedBy.join(', '),
        diagnosticInfo.modalStates.blockedBy.length > 0,
      ],
      [
        'Interactable elements',
        diagnosticInfo.elements.totalInteractable,
        true,
      ],
    ];

    for (const [key, value, condition] of criticalInfo) {
      if (condition) {
        this.reportBuilder.addKeyValue(key, value);
      }
    }

    this.reportBuilder.addEmptyLine();
  }

  private addDetailedPageStructure(
    diagnosticInfo: PageStructureAnalysis
  ): void {
    this.reportBuilder.addHeader('Page Structure Analysis', 2);

    const structureData: [string, string | number][] = [
      [
        'IFrames',
        `${diagnosticInfo.iframes.count} iframes detected: ${diagnosticInfo.iframes.detected}`,
      ],
      ['Accessible iframes', diagnosticInfo.iframes.accessible.length],
      ['Inaccessible iframes', diagnosticInfo.iframes.inaccessible.length],
    ];

    this.addKeyValuePairs(structureData);

    const elementData: [string, string | number][] = [
      ['Total visible elements', diagnosticInfo.elements.totalVisible],
      [
        'Total interactable elements',
        diagnosticInfo.elements.totalInteractable,
      ],
      ['Elements missing ARIA', diagnosticInfo.elements.missingAria],
    ];

    this.addKeyValuePairs(elementData);
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
      for (let index = 0; index < foundElements.length; index++) {
        const element = foundElements[index];
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
    const layoutData: [string, number][] = [
      [
        'Fixed position elements',
        metrics?.layoutMetrics?.fixedElements?.length ?? 0,
      ],
      [
        'High z-index elements',
        metrics?.layoutMetrics?.highZIndexElements?.length ?? 0,
      ],
      [
        'Overflow hidden elements',
        metrics?.layoutMetrics?.overflowHiddenElements ?? 0,
      ],
    ];

    this.addKeyValuePairs(layoutData, undefined, 'Layout Analysis', 3);

    this.addElementList(
      'Fixed Elements',
      metrics?.layoutMetrics?.fixedElements,
      (element, index) =>
        `${index + 1}. **${element.selector}**: ${element.purpose} (z-index: ${element.zIndex})`
    );

    this.addElementList(
      'High Z-Index Elements',
      metrics?.layoutMetrics?.highZIndexElements,
      (element, index) =>
        `${index + 1}. **${element.selector}**: z-index ${element.zIndex} (${element.description})`
    );
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
        const navigationEntries = performance.getEntriesByType('navigation');
        const navigation = navigationEntries[0] as
          | PerformanceNavigationTiming
          | undefined;
        const paint = performance.getEntriesByType('paint');

        return {
          domContentLoaded:
            navigation?.domContentLoadedEventEnd != null &&
            navigation?.domContentLoadedEventStart != null
              ? navigation.domContentLoadedEventEnd -
                navigation.domContentLoadedEventStart
              : undefined,
          loadComplete:
            navigation?.loadEventEnd != null &&
            navigation?.loadEventStart != null
              ? navigation.loadEventEnd - navigation.loadEventStart
              : undefined,
          firstPaint: paint.find((p) => p.name === 'first-paint')?.startTime,
          firstContentfulPaint: paint.find(
            (p) => p.name === 'first-contentful-paint'
          )?.startTime,
        };
      });

      const metricsWithValues = processBrowserMetrics(browserMetrics);

      if (metricsWithValues.length > 0) {
        this.addKeyValuePairs(
          metricsWithValues,
          undefined,
          'Browser Performance Timing',
          3
        );
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
    if (!this.shouldIncludeSection(options, 'accessibility')) {
      return;
    }

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

    const a11yData: [string, string | number][] = [
      [
        'Elements with missing ARIA labels',
        diagnosticInfo.elements.missingAria,
      ],
      ['Heading elements', a11yMetrics.headings],
      ['Landmark elements', a11yMetrics.landmarks],
      [
        'Images with alt text',
        `${a11yMetrics.imagesWithAlt}/${a11yMetrics.totalImages}`,
      ],
    ];

    this.addKeyValuePairs(a11yData, 'Accessibility Information');
  }

  private addTroubleshootingSection(
    diagnosticInfo: PageStructureAnalysis,
    options: ReportOptions
  ): void {
    if (!this.shouldIncludeSection(options, 'troubleshooting')) {
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
