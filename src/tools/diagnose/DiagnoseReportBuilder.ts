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
  private reportSections: string[] = [];
  private tab: Tab;

  constructor(tab: Tab) {
    this.tab = tab;
  }

  async buildReport(
    analysisResult: AnalysisResult,
    unifiedSystem: UnifiedDiagnosticSystem | null,
    pageAnalyzer: PageAnalyzer | null,
    options: ReportOptions
  ): Promise<string> {
    this.reportSections = [];

    if (options.diagnosticLevel === 'none') {
      return 'Diagnostics disabled (level: none)';
    }

    await this.addReportHeader(analysisResult, unifiedSystem, options);
    await this.addPageStructureSection(analysisResult.diagnosticInfo, options);
    await this.addModalStatesSection(analysisResult.diagnosticInfo);
    await this.addElementSearchSection(options);
    await this.addPerformanceSection(
      analysisResult,
      unifiedSystem,
      pageAnalyzer,
      options
    );
    await this.addAccessibilitySection(analysisResult.diagnosticInfo, options);
    await this.addTroubleshootingSection(
      analysisResult.diagnosticInfo,
      options
    );

    return this.reportSections.join('\n');
  }

  private async addReportHeader(
    analysisResult: AnalysisResult,
    unifiedSystem: UnifiedDiagnosticSystem | null,
    options: ReportOptions
  ): Promise<void> {
    if (unifiedSystem) {
      this.reportSections.push(
        '# Unified Diagnostic System Report',
        '**Unified System Status:** Active with enhanced error handling and monitoring',
        `**Configuration:** ${options.appliedOverrides?.length ? 'Custom overrides applied' : 'Default settings'}`,
        ''
      );

      if (options.appliedOverrides?.length) {
        this.reportSections.push('## Applied Configuration Overrides');
        for (const override of options.appliedOverrides) {
          this.reportSections.push(`- **${override}**`);
        }
        this.reportSections.push('');
      }

      this.reportSections.push(
        `**Analysis Type:** ${analysisResult.analysisType}`
      );
      this.reportSections.push(
        `**Analysis Status:** ${analysisResult.analysisStatus}`
      );

      if (analysisResult.errors?.length) {
        this.reportSections.push('## Analysis Warnings');
        for (const error of analysisResult.errors) {
          this.reportSections.push(`- **${error}**`);
        }
      }

      await this.addSystemHealthSection(analysisResult, unifiedSystem, options);
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

    const systemStats = unifiedSystem.getSystemStats();

    this.reportSections.push('');
    this.reportSections.push('## Unified System Health');
    this.reportSections.push(
      `- **System Status:** ${analysisResult.systemHealthInfo.status}`
    );
    this.reportSections.push(
      `- **Total Operations:** ${systemStats.performanceMetrics.totalOperations}`
    );
    this.reportSections.push(
      `- **Success Rate:** ${(systemStats.performanceMetrics.successRate * 100).toFixed(1)}%`
    );
    this.reportSections.push(
      `- **Active Handles:** ${systemStats.resourceUsage.currentHandles}`
    );
    this.reportSections.push(
      `- **Total Errors:** ${Object.values(systemStats.errorCount).reduce((sum, count) => sum + count, 0)}`
    );

    this.addConfigurationImpactSection(unifiedSystem, options);
    this.addSystemIssuesAndRecommendations(analysisResult.systemHealthInfo);
  }

  private addConfigurationImpactSection(
    unifiedSystem: UnifiedDiagnosticSystem,
    options: ReportOptions
  ): void {
    if (!options.appliedOverrides?.length) {
      return;
    }

    const configReport = unifiedSystem.getConfigurationReport();

    this.reportSections.push('');
    this.reportSections.push('### Configuration Impact Analysis');
    this.reportSections.push(
      `- **Configuration Status:** ${configReport.configurationStatus.replace('-', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}`
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

    this.reportSections.push('');
    this.reportSections.push('**Performance Baseline Comparison:**');
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

        this.reportSections.push(
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

    this.reportSections.push('');
    this.reportSections.push('**Applied Configuration Changes:**');
    for (const override of configReport.appliedOverrides) {
      const impactIcon = this.getImpactIcon(override.impact);
      this.reportSections.push(
        `  ${impactIcon} **${override.category}** (${override.impact} impact):`
      );
      for (const change of override.changes) {
        this.reportSections.push(`    - ${change}`);
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

    this.reportSections.push('');
    this.reportSections.push('**High Priority Recommendations:**');
    for (const rec of highPriorityRecs) {
      const typeIcon = this.getRecommendationTypeIcon(rec.type);
      this.reportSections.push(`  ${typeIcon} ${rec.message}`);
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
      this.reportSections.push('');
      this.reportSections.push('### System Issues');
      for (const issue of systemHealthInfo.issues) {
        this.reportSections.push(`- ⚠️ ${issue}`);
      }
    }

    if (systemHealthInfo.recommendations.length > 0) {
      this.reportSections.push('');
      this.reportSections.push('### System Recommendations');
      for (const rec of systemHealthInfo.recommendations) {
        this.reportSections.push(`- 💡 ${rec}`);
      }
    }

    this.reportSections.push('');
  }

  private async addPageStructureSection(
    diagnosticInfo: PageStructureAnalysis,
    options: ReportOptions
  ): Promise<void> {
    if (options.diagnosticLevel === 'basic') {
      this.reportSections.push(
        '# Basic Diagnostic Report',
        `**URL:** ${this.tab.page.url()}`,
        '',
        '## Critical Information'
      );

      if (diagnosticInfo.iframes.detected) {
        this.reportSections.push(
          `- **IFrames detected:** ${diagnosticInfo.iframes.count}`
        );
      }

      if (diagnosticInfo.modalStates.blockedBy.length > 0) {
        this.reportSections.push(
          `- **Active modals:** ${diagnosticInfo.modalStates.blockedBy.join(', ')}`
        );
      }

      this.reportSections.push(
        `- **Interactable elements:** ${diagnosticInfo.elements.totalInteractable}`
      );
      this.reportSections.push('');
    } else {
      this.reportSections.push(
        '# Page Diagnostic Report',
        `**URL:** ${this.tab.page.url()}`,
        `**Title:** ${await this.tab.page.title()}`,
        '',
        '## Page Structure Analysis',
        `- **IFrames:** ${diagnosticInfo.iframes.count} iframes detected: ${diagnosticInfo.iframes.detected}`,
        `- **Accessible iframes:** ${diagnosticInfo.iframes.accessible.length}`,
        `- **Inaccessible iframes:** ${diagnosticInfo.iframes.inaccessible.length}`,
        '',
        `- **Total visible elements:** ${diagnosticInfo.elements.totalVisible}`,
        `- **Total interactable elements:** ${diagnosticInfo.elements.totalInteractable}`,
        `- **Elements missing ARIA:** ${diagnosticInfo.elements.missingAria}`,
        ''
      );
    }
  }

  private addModalStatesSection(diagnosticInfo: PageStructureAnalysis): void {
    if (diagnosticInfo.modalStates.blockedBy.length > 0) {
      this.reportSections.push('## Modal States');
      this.reportSections.push(
        `- **Active modals:** ${diagnosticInfo.modalStates.blockedBy.join(', ')}`
      );
      this.reportSections.push('');
    }
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

    this.reportSections.push('## Element Search Results');
    if (foundElements.length === 0) {
      this.reportSections.push(
        '- No elements found matching the search criteria'
      );
    } else {
      this.reportSections.push(
        `Found ${foundElements.length} matching elements:`
      );
      for (const [index, element] of foundElements.entries()) {
        this.reportSections.push(
          `${index + 1}. **${element.selector}** (${(element.confidence * 100).toFixed(0)}% confidence)`
        );
        this.reportSections.push(`   - ${element.reason}`);
      }
    }
    this.reportSections.push('');
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

    this.reportSections.push('## Performance Metrics');
    this.reportSections.push(
      `- **Diagnosis execution time:** ${diagnosisTime}ms`
    );

    try {
      const comprehensiveMetrics = await this.getComprehensiveMetrics(
        analysisResult,
        unifiedSystem,
        pageAnalyzer
      );

      this.addDomComplexityMetrics(comprehensiveMetrics);
      this.addInteractionMetrics(comprehensiveMetrics);
      this.addResourceMetrics(comprehensiveMetrics);

      if (options.diagnosticLevel === 'full') {
        this.addLayoutMetrics(comprehensiveMetrics);
      }

      this.addPerformanceWarnings(comprehensiveMetrics);
    } catch (error) {
      this.reportSections.push('');
      this.reportSections.push(
        `- **Error analyzing performance metrics:** ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }

    await this.addBrowserPerformanceMetrics();
    this.reportSections.push('');
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
        `Performance metrics analysis failed: ${perfResult.error?.message || 'Unknown error'}`
      );
    }

    throw new Error('No performance analyzer available');
  }

  private addDomComplexityMetrics(metrics: PageMetrics): void {
    this.reportSections.push('');
    this.reportSections.push('### DOM Complexity');
    this.reportSections.push(
      `- **Total DOM elements:** ${metrics?.domMetrics?.totalElements || 0}`
    );
    this.reportSections.push(
      `- **Max DOM depth:** ${metrics?.domMetrics?.maxDepth || 0} levels`
    );

    if (
      metrics?.domMetrics?.largeSubtrees?.length &&
      metrics.domMetrics.largeSubtrees.length > 0
    ) {
      this.reportSections.push(
        `- **Large subtrees detected:** ${metrics.domMetrics.largeSubtrees.length}`
      );
      for (const [index, subtree] of metrics.domMetrics.largeSubtrees
        .slice(0, 3)
        .entries()) {
        this.reportSections.push(
          `  ${index + 1}. **${subtree.selector}**: ${subtree.elementCount} elements (${subtree.description})`
        );
      }
    }
  }

  private addInteractionMetrics(metrics: PageMetrics): void {
    this.reportSections.push('');
    this.reportSections.push('### Interaction Elements');
    this.reportSections.push(
      `- **Clickable elements:** ${metrics?.interactionMetrics?.clickableElements || 0}`
    );
    this.reportSections.push(
      `- **Form elements:** ${metrics?.interactionMetrics?.formElements || 0}`
    );
    this.reportSections.push(
      `- **Disabled elements:** ${metrics?.interactionMetrics?.disabledElements || 0}`
    );
  }

  private addResourceMetrics(metrics: PageMetrics): void {
    this.reportSections.push('');
    this.reportSections.push('### Resource Load');
    this.reportSections.push(
      `- **Images:** ${metrics?.resourceMetrics?.imageCount || 0} (${metrics?.resourceMetrics?.estimatedImageSize || 'Unknown'})`
    );
    this.reportSections.push(
      `- **Script tags:** ${metrics?.resourceMetrics?.scriptTags || 0} (${metrics?.resourceMetrics?.externalScripts || 0} external, ${metrics?.resourceMetrics?.inlineScripts || 0} inline)`
    );
    this.reportSections.push(
      `- **Stylesheets:** ${metrics?.resourceMetrics?.stylesheetCount || 0}`
    );
  }

  private addLayoutMetrics(metrics: PageMetrics): void {
    this.reportSections.push('');
    this.reportSections.push('### Layout Analysis');
    this.reportSections.push(
      `- **Fixed position elements:** ${metrics?.layoutMetrics?.fixedElements?.length || 0}`
    );
    this.reportSections.push(
      `- **High z-index elements:** ${metrics?.layoutMetrics?.highZIndexElements?.length || 0}`
    );
    this.reportSections.push(
      `- **Overflow hidden elements:** ${metrics?.layoutMetrics?.overflowHiddenElements || 0}`
    );

    if (
      metrics?.layoutMetrics?.fixedElements?.length &&
      metrics.layoutMetrics.fixedElements.length > 0
    ) {
      this.reportSections.push('');
      this.reportSections.push('**Fixed Elements:**');
      for (const [index, element] of metrics.layoutMetrics.fixedElements
        .slice(0, 5)
        .entries()) {
        this.reportSections.push(
          `${index + 1}. **${element.selector}**: ${element.purpose} (z-index: ${element.zIndex})`
        );
      }
    }

    if (
      metrics?.layoutMetrics?.highZIndexElements?.length &&
      metrics.layoutMetrics.highZIndexElements.length > 0
    ) {
      this.reportSections.push('');
      this.reportSections.push('**High Z-Index Elements:**');
      for (const [index, element] of metrics.layoutMetrics.highZIndexElements
        .slice(0, 5)
        .entries()) {
        this.reportSections.push(
          `${index + 1}. **${element.selector}**: z-index ${element.zIndex} (${element.description})`
        );
      }
    }
  }

  private addPerformanceWarnings(metrics: PageMetrics): void {
    if (metrics?.warnings?.length && metrics.warnings.length > 0) {
      this.reportSections.push('');
      this.reportSections.push('### Performance Warnings');
      for (const warning of metrics.warnings) {
        const icon = warning.level === 'danger' ? '🚨' : '⚠️';
        this.reportSections.push(
          `- ${icon} **${warning.type}**: ${warning.message}`
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
        this.reportSections.push('');
        this.reportSections.push('### Browser Performance Timing');

        if (browserMetrics.domContentLoaded) {
          this.reportSections.push(
            `- **DOM Content Loaded:** ${browserMetrics.domContentLoaded.toFixed(2)}ms`
          );
        }
        if (browserMetrics.loadComplete) {
          this.reportSections.push(
            `- **Load Complete:** ${browserMetrics.loadComplete.toFixed(2)}ms`
          );
        }
        if (browserMetrics.firstPaint) {
          this.reportSections.push(
            `- **First Paint:** ${browserMetrics.firstPaint.toFixed(2)}ms`
          );
        }
        if (browserMetrics.firstContentfulPaint) {
          this.reportSections.push(
            `- **First Contentful Paint:** ${browserMetrics.firstContentfulPaint.toFixed(2)}ms`
          );
        }
      }
    } catch (error) {
      this.reportSections.push('');
      this.reportSections.push(
        `- **Browser timing metrics unavailable:** ${error instanceof Error ? error.message : 'Unknown error'}`
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

    this.reportSections.push('## Accessibility Information');
    this.reportSections.push(
      `- **Elements with missing ARIA labels:** ${diagnosticInfo.elements.missingAria}`
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

    this.reportSections.push(`- **Heading elements:** ${a11yMetrics.headings}`);
    this.reportSections.push(
      `- **Landmark elements:** ${a11yMetrics.landmarks}`
    );
    this.reportSections.push(
      `- **Images with alt text:** ${a11yMetrics.imagesWithAlt}/${a11yMetrics.totalImages}`
    );
    this.reportSections.push('');
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

    this.reportSections.push('## Troubleshooting Suggestions');

    const suggestions: string[] = [];

    if (diagnosticInfo.iframes.detected) {
      suggestions.push(
        'Elements might be inside iframes - use frameLocator() for iframe interactions'
      );
    }

    if (diagnosticInfo.modalStates.blockedBy.length > 0) {
      suggestions.push(
        `Active modal states (${diagnosticInfo.modalStates.blockedBy.join(', ')}) may block interactions`
      );
    }

    if (diagnosticInfo.elements.missingAria > 0) {
      suggestions.push(
        `${diagnosticInfo.elements.missingAria} elements lack proper ARIA attributes - consider using text-based selectors`
      );
    }

    if (
      diagnosticInfo.elements.totalInteractable <
      diagnosticInfo.elements.totalVisible * 0.1
    ) {
      suggestions.push(
        'Low ratio of interactable elements - page might still be loading or have CSS issues'
      );
    }

    if (suggestions.length === 0) {
      suggestions.push(
        'No obvious issues detected - page appears to be in good state for automation'
      );
    }

    for (const suggestion of suggestions) {
      this.reportSections.push(`- ${suggestion}`);
    }
    this.reportSections.push('');
  }
}
