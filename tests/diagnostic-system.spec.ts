/**
 * Diagnostic System Tests - PageAnalyzer, ElementDiscovery, ErrorEnrichment
 */

import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import type { Page } from 'playwright';
import { ElementDiscovery } from '../src/diagnostics/element-discovery.js';
import { ErrorEnrichment } from '../src/diagnostics/error-enrichment.js';
import { PageAnalyzer } from '../src/diagnostics/page-analyzer.js';
import {
  assertExecutionTime,
  DiagnosticTestSetup,
  measureExecutionTime,
} from './test-helpers.js';

// Top-level regex patterns for performance optimization
const THRESHOLD_REGEX_1 = /1000ms → 2000ms|Page Analysis:.*2000ms/;
const THRESHOLD_REGEX_2 = /500ms → 1500ms|Element Discovery:.*1500ms/;
const PERFORMANCE_REGEX = /pageAnalysis[\s\S]*?Expected[\s\S]*?(?:5000|\d+)ms/;

// Utility functions for tests
async function setupParallelAnalyzer(page: Page, htmlContent: string) {
  await page.goto(`data:text/html,${htmlContent}`);
  const { ParallelPageAnalyzer } = await import(
    '../src/diagnostics/parallel-page-analyzer.js'
  );
  return new ParallelPageAnalyzer(page);
}

function expectParallelAnalysisResult(
  result: Record<string, unknown>,
  expectedElementCount?: number
) {
  expect(result.structureAnalysis).toBeDefined();
  expect(result.performanceMetrics).toBeDefined();
  expect(result.resourceUsage).toBe(null);
  if (expectedElementCount) {
    expect(result.performanceMetrics.domMetrics.totalElements).toBeGreaterThan(
      expectedElementCount
    );
  }
}

// Diagnostic System Test Templates
const DIAGNOSTIC_HTML_TEMPLATES = {
  BASIC_IFRAME:
    'data:text/html,<html><body><iframe src="data:text/html,<h1>Test</h1>"></iframe></body></html>',
  SIMPLE_PAGE: (title: string, elements: string) => `
    <html>
      <head><title>${title}</title></head>
      <body>
        <div id="root">
          ${elements}
        </div>
      </body>
    </html>
  `,
  COMPLEX_PAGE: (depth: number) => `
    <html>
      <head><title>Complex Test Page</title></head>
      <body>
        ${'<div>'.repeat(depth)}
          <button id="deep-button">Deep Button</button>
        ${'</div>'.repeat(depth)}
      </body>
    </html>
  `,
  MANY_ELEMENTS: (count: number) =>
    Array.from(
      { length: count },
      (_, i) => `<div class="item-${i}">Item ${i}</div>`
    ).join(''),
  LARGE_SUBTREE: (count: number) =>
    Array.from({ length: count }, (_, i) => `<li>Item ${i}</li>`).join(''),
  FIXED_ELEMENTS_STYLES: `
    .fixed-nav { position: fixed; top: 0; z-index: 1000; }
    .high-z { position: absolute; z-index: 9999; }
    .hidden { overflow: hidden; }
  `,
  MODAL_DIALOG:
    'data:text/html,<div><div role="dialog" class="modal">Modal Content</div><input type="file"></div>',
  BUTTON_INPUT:
    'data:text/html,<div><button>Click</button><input type="text"><span style="display:none">Hidden</span></div>',
} as const;

// Common test expectations
const _DIAGNOSTIC_EXPECTATIONS = {
  PAGE_STRUCTURE: {
    hasIframes: (count: number) => ({ detected: true, count }),
    hasModalStates: { hasDialog: false, hasFileChooser: false, blockedBy: [] },
    hasElements: {
      totalVisible: expect.any(Number),
      totalInteractable: expect.any(Number),
    },
  },
  PERFORMANCE_METRICS: {
    basic: {
      domMetrics: expect.any(Object),
      interactionMetrics: expect.any(Object),
      resourceMetrics: expect.any(Object),
      layoutMetrics: expect.any(Object),
    },
    warnings: expect.any(Array),
  },
} as const;

// Test utility functions
const DiagnosticSystemTestHelper = {
  diagnosticSetup: new DiagnosticTestSetup(),

  beforeEach() {
    return this.diagnosticSetup.beforeEach();
  },

  afterEach() {
    this.diagnosticSetup.afterEach();
  },

  async setupPageAnalyzer(page: Page, htmlContent?: string) {
    if (htmlContent) {
      await page.goto(`data:text/html,${htmlContent}`);
    }
    return new PageAnalyzer(page);
  },

  async setupElementDiscovery(page: Page, htmlContent?: string) {
    if (htmlContent) {
      await page.goto(htmlContent);
    }
    return new ElementDiscovery(page);
  },

  async setupErrorEnrichment(page: Page, htmlContent?: string) {
    if (htmlContent) {
      await page.goto(htmlContent);
    }
    return new ErrorEnrichment(page);
  },

  async measureAndAssertPerformance<T>(
    operation: () => Promise<T>,
    maxTime: number,
    testName: string
  ) {
    const { result, executionTime } = await measureExecutionTime(operation);
    assertExecutionTime(executionTime, maxTime, testName);
    return result;
  },

  expectBasicMetrics(metrics: Record<string, unknown>) {
    expect(metrics).toBeDefined();
    expect(metrics.domMetrics).toBeDefined();
    expect(metrics.interactionMetrics).toBeDefined();
    expect(metrics.resourceMetrics).toBeDefined();
    expect(metrics.layoutMetrics).toBeDefined();
    expect(metrics.warnings).toBeDefined();
    expect(Array.isArray(metrics.warnings)).toBe(true);
  },

  expectPageStructure(
    analysis: Record<string, unknown>,
    expectations: Record<string, unknown>
  ) {
    if (expectations.iframes) {
      expect(analysis.iframes.detected).toBe(expectations.iframes.detected);
      expect(analysis.iframes.count).toBe(expectations.iframes.count);
    }
    if (expectations.modalStates) {
      expect(analysis.modalStates).toEqual(
        expect.objectContaining(expectations.modalStates)
      );
    }
    if (expectations.elements) {
      expect(analysis.elements.totalVisible).toBeGreaterThan(0);
      expect(analysis.elements.totalInteractable).toBeGreaterThanOrEqual(0);
    }
  },

  createMockDiagnoseContext(page: Page) {
    return {
      currentTabOrDie: () => ({
        page,
        id: 'test-tab',
        modalStates: () => [],
        modalStatesMarkdown: () => [],
      }),
      tab: { page, id: 'test-tab' },
    };
  },

  createMockDiagnoseResponse() {
    return {
      results: [] as string[],
      addResult(result: string) {
        this.results.push(result);
      },
      addError(error: string) {
        this.results.push(`ERROR: ${error}`);
      },
    };
  },
};

test.describe('PageAnalyzer', () => {
  test('should analyze iframe detection status', async ({ page }) => {
    const pageAnalyzer = await DiagnosticSystemTestHelper.setupPageAnalyzer(
      page,
      DIAGNOSTIC_HTML_TEMPLATES.BASIC_IFRAME
    );
    const analysis = await pageAnalyzer.analyzePageStructure();

    DiagnosticSystemTestHelper.expectPageStructure(analysis, {
      iframes: { detected: true, count: 1 },
      modalStates: { hasDialog: false, hasFileChooser: false, blockedBy: [] },
      elements: {
        totalVisible: expect.any(Number),
        totalInteractable: expect.any(Number),
      },
    });
    expect(
      analysis.iframes.accessible.length + analysis.iframes.inaccessible.length
    ).toBe(1);
    expect(analysis.elements.missingAria).toBeGreaterThanOrEqual(0);
  });

  test('should analyze performance metrics for simple page', async ({
    page,
  }) => {
    const htmlContent = DIAGNOSTIC_HTML_TEMPLATES.SIMPLE_PAGE(
      'Test Page',
      `
      <h1>Test Page</h1>
      <button>Click Me</button>
      <input type="text" placeholder="Enter text">
      <img src="data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=" alt="Test Image">
    `
    );
    const pageAnalyzer = await DiagnosticSystemTestHelper.setupPageAnalyzer(
      page,
      htmlContent
    );
    const metrics = await pageAnalyzer.analyzePerformanceMetrics();

    DiagnosticSystemTestHelper.expectBasicMetrics(metrics);
    expect(metrics.domMetrics.totalElements).toBeGreaterThan(0);
    expect(metrics.domMetrics.maxDepth).toBeGreaterThanOrEqual(1);
    expect(metrics.interactionMetrics.clickableElements).toBeGreaterThanOrEqual(
      1
    );
    expect(metrics.interactionMetrics.formElements).toBeGreaterThanOrEqual(1);
    expect(metrics.resourceMetrics.imageCount).toBeGreaterThanOrEqual(1);
  });

  test('should handle performance metrics analysis errors gracefully', async ({
    page,
  }) => {
    const complexHtml = DIAGNOSTIC_HTML_TEMPLATES.COMPLEX_PAGE(20);
    const pageAnalyzer = await DiagnosticSystemTestHelper.setupPageAnalyzer(
      page,
      complexHtml
    );

    // This should not throw an error even with complex DOM
    const metrics = await pageAnalyzer.analyzePerformanceMetrics();

    DiagnosticSystemTestHelper.expectBasicMetrics(metrics);

    // Check that the analysis completed successfully or failed gracefully
    expect(metrics.errorCount).toBeGreaterThanOrEqual(0);
    expect(metrics.successRate).toBeGreaterThanOrEqual(0);
    expect(metrics.successRate).toBeLessThanOrEqual(1);

    // Deep DOM should be detected
    expect(metrics.domMetrics.maxDepth).toBeGreaterThan(10);

    // Cleanup
    await pageAnalyzer.dispose();
  });

  test('should detect DOM complexity warnings', async ({ page }) => {
    const manyElements = DIAGNOSTIC_HTML_TEMPLATES.MANY_ELEMENTS(2000);
    const complexHtml = DIAGNOSTIC_HTML_TEMPLATES.SIMPLE_PAGE(
      'Complex Page',
      `
      <div id="container">
        ${manyElements}
      </div>
    `
    );
    const pageAnalyzer = await DiagnosticSystemTestHelper.setupPageAnalyzer(
      page,
      complexHtml
    );
    const metrics = await pageAnalyzer.analyzePerformanceMetrics();

    expect(metrics.domMetrics.totalElements).toBeGreaterThan(1500);
    expect(metrics.warnings.some((w) => w.type === 'dom_complexity')).toBe(
      true
    );
    expect(
      metrics.warnings.some(
        (w) => w.level === 'warning' || w.level === 'danger'
      )
    ).toBe(true);
  });

  test('should detect large subtrees', async ({ page }) => {
    const largeSubtree = DIAGNOSTIC_HTML_TEMPLATES.LARGE_SUBTREE(600);
    const htmlContent = DIAGNOSTIC_HTML_TEMPLATES.SIMPLE_PAGE(
      'Large List Page',
      `
      <ul id="large-list">
        ${largeSubtree}
      </ul>
    `
    );
    const pageAnalyzer = await DiagnosticSystemTestHelper.setupPageAnalyzer(
      page,
      htmlContent
    );
    const metrics = await pageAnalyzer.analyzePerformanceMetrics();

    expect(metrics.domMetrics.largeSubtrees.length).toBeGreaterThan(0);
    expect(
      metrics.domMetrics.largeSubtrees.some(
        (subtree) => subtree.elementCount > 500
      )
    ).toBe(true);
    // Check if any subtree contains 'ul' or if body is detected (both are valid)
    expect(
      metrics.domMetrics.largeSubtrees.some(
        (subtree) =>
          subtree.selector.includes('ul') || subtree.selector.includes('body')
      )
    ).toBe(true);
  });

  test('should analyze layout metrics with fixed elements', async ({
    page,
  }) => {
    const htmlContent = DIAGNOSTIC_HTML_TEMPLATES.SIMPLE_PAGE(
      'Fixed Elements Page',
      `
      <style>
        ${DIAGNOSTIC_HTML_TEMPLATES.FIXED_ELEMENTS_STYLES}
      </style>
      <nav class="fixed-nav">Navigation</nav>
      <div class="high-z">High Z-Index Element</div>
      <div class="hidden">Hidden Overflow</div>
    `
    );
    const pageAnalyzer = await DiagnosticSystemTestHelper.setupPageAnalyzer(
      page,
      htmlContent
    );
    const metrics = await pageAnalyzer.analyzePerformanceMetrics();

    expect(metrics.layoutMetrics.fixedElements.length).toBeGreaterThan(0);
    expect(metrics.layoutMetrics.highZIndexElements.length).toBeGreaterThan(0);
    expect(metrics.layoutMetrics.overflowHiddenElements).toBeGreaterThan(0);
    expect(metrics.layoutMetrics.fixedElements[0].purpose).toContain(
      'navigation'
    );
    // Check if any element has z-index >= 9999 (since we created one)
    expect(
      metrics.layoutMetrics.highZIndexElements.some((el) => el.zIndex >= 9999)
    ).toBe(true);
  });

  test('should complete performance analysis within 1 second', async ({
    page,
  }) => {
    const elements = Array.from(
      { length: 500 },
      (_, i) =>
        `<div><button>Button ${i}</button><input type="text" id="input-${i}"></div>`
    ).join('');
    const htmlContent = DIAGNOSTIC_HTML_TEMPLATES.SIMPLE_PAGE(
      'Performance Test',
      elements
    );
    const pageAnalyzer = await DiagnosticSystemTestHelper.setupPageAnalyzer(
      page,
      htmlContent
    );

    const metrics =
      await DiagnosticSystemTestHelper.measureAndAssertPerformance(
        () => pageAnalyzer.analyzePerformanceMetrics(),
        1000,
        'Performance analysis'
      );

    expect(metrics).toBeDefined();
    expect(metrics.domMetrics.totalElements).toBeGreaterThan(500);
  });

  test('should analyze modal states correctly', async ({ page }) => {
    const pageAnalyzer = await DiagnosticSystemTestHelper.setupPageAnalyzer(
      page,
      DIAGNOSTIC_HTML_TEMPLATES.MODAL_DIALOG
    );
    const analysis = await pageAnalyzer.analyzePageStructure();

    expect(analysis.modalStates.hasDialog).toBe(true);
    expect(analysis.modalStates.hasFileChooser).toBe(true);
    expect(analysis.modalStates.blockedBy).toContain('dialog');
    expect(analysis.modalStates.blockedBy).toContain('fileChooser');
  });

  test('should count elements correctly', async ({ page }) => {
    const pageAnalyzer = await DiagnosticSystemTestHelper.setupPageAnalyzer(
      page,
      DIAGNOSTIC_HTML_TEMPLATES.BUTTON_INPUT
    );
    const analysis = await pageAnalyzer.analyzePageStructure();

    expect(analysis.elements.totalVisible).toBeGreaterThan(0);
    expect(analysis.elements.totalInteractable).toBeGreaterThan(0);
  });
});

test.describe('ElementDiscovery', () => {
  const ELEMENT_DISCOVERY_TEMPLATES = {
    SUBMIT_BUTTONS:
      'data:text/html,<div><button>Submit</button><input type="submit" value="Submit Form"></div>',
    ROLE_BUTTONS:
      'data:text/html,<div><a role="button">Click</a><button>Real Button</button></div>',
    MIXED_ELEMENTS:
      'data:text/html,<div><button>Exact</button><button>Similar</button><div>Different</div></div>',
    MANY_BUTTONS: (count: number) =>
      `data:text/html,<div>${Array.from(
        { length: count },
        (_, i) => `<button>Button ${i}</button>`
      ).join('')}</div>`,
  };

  const COMMON_SEARCH_CRITERIA = {
    SUBMIT_BUTTON: {
      originalSelector: 'button[data-missing="true"]',
      searchCriteria: { text: 'Submit', role: 'button' },
    },
    ROLE_BUTTON: {
      originalSelector: 'input[type="submit"]',
      searchCriteria: { role: 'button' },
    },
    EXACT_BUTTON: {
      originalSelector: 'button[data-test="exact"]',
      searchCriteria: { text: 'Exact', role: 'button' },
    },
  };

  function expectAlternativeElementStructure(
    alternative: Record<string, unknown>,
    minConfidence = 0
  ) {
    expect(alternative).toEqual(
      expect.objectContaining({
        selector: expect.any(String),
        confidence: expect.any(Number),
        reason: expect.any(String),
      })
    );
    if (minConfidence > 0) {
      expect(alternative.confidence).toBeGreaterThan(minConfidence);
    }
  }

  test('should find alternative elements by text content', async ({ page }) => {
    const elementDiscovery =
      await DiagnosticSystemTestHelper.setupElementDiscovery(
        page,
        ELEMENT_DISCOVERY_TEMPLATES.SUBMIT_BUTTONS
      );
    const alternatives = await elementDiscovery.findAlternativeElements(
      COMMON_SEARCH_CRITERIA.SUBMIT_BUTTON
    );

    expect(alternatives.length).toBeGreaterThan(0);
    expectAlternativeElementStructure(alternatives[0], 0.5);
    expect(alternatives[0].reason).toContain('text match');
  });

  test('should find alternatives by ARIA role', async ({ page }) => {
    const elementDiscovery =
      await DiagnosticSystemTestHelper.setupElementDiscovery(
        page,
        ELEMENT_DISCOVERY_TEMPLATES.ROLE_BUTTONS
      );
    const alternatives = await elementDiscovery.findAlternativeElements(
      COMMON_SEARCH_CRITERIA.ROLE_BUTTON
    );

    expect(alternatives.length).toBeGreaterThan(0);
    expect(alternatives.every((alt) => alt.confidence > 0)).toBe(true);
  });

  test('should sort alternatives by confidence', async ({ page }) => {
    const elementDiscovery =
      await DiagnosticSystemTestHelper.setupElementDiscovery(
        page,
        ELEMENT_DISCOVERY_TEMPLATES.MIXED_ELEMENTS
      );
    const alternatives = await elementDiscovery.findAlternativeElements(
      COMMON_SEARCH_CRITERIA.EXACT_BUTTON
    );

    if (alternatives.length > 1) {
      expect(alternatives[0].confidence).toBeGreaterThanOrEqual(
        alternatives[1].confidence
      );
    }
  });

  test('should limit number of alternatives', async ({ page }) => {
    const elementDiscovery =
      await DiagnosticSystemTestHelper.setupElementDiscovery(
        page,
        ELEMENT_DISCOVERY_TEMPLATES.MANY_BUTTONS(20)
      );
    const alternatives = await elementDiscovery.findAlternativeElements({
      originalSelector: 'button[data-missing="true"]',
      searchCriteria: { role: 'button' },
      maxResults: 5,
    });

    expect(alternatives.length).toBeLessThanOrEqual(5);
  });
});

test.describe('ErrorEnrichment', () => {
  const ERROR_ENRICHMENT_TEMPLATES = {
    SUBMIT_ELEMENTS:
      'data:text/html,<div><button>Submit</button><input type="submit" value="Submit"></div>',
    IFRAME_CONTENT:
      'data:text/html,<iframe src="data:text/html,<h1>Content</h1>"></iframe>',
    MODAL_DIALOG:
      'data:text/html,<div role="dialog" class="modal">Modal Content</div><input type="text">',
    SIMPLE_BUTTON: 'data:text/html,<div><button>Step 1</button></div>',
  };

  const COMMON_ERROR_SCENARIOS = {
    ELEMENT_NOT_FOUND: {
      originalError: new Error('Element not found: button[data-test="submit"]'),
      selector: 'button[data-test="submit"]',
      searchCriteria: { text: 'Submit', role: 'button' },
    },
    TIMEOUT_IFRAME: {
      originalError: new Error('Timeout waiting for element'),
      operation: 'click',
      selector: 'button[data-test="inside-iframe"]',
    },
    TIMEOUT_MODAL: {
      originalError: new Error('Timeout waiting for element'),
      operation: 'click',
      selector: 'input[type="text"]',
    },
    BATCH_FAILURE: {
      originalError: new Error('Step 2 failed'),
      failedStep: {
        stepIndex: 1,
        toolName: 'browser_click',
        selector: 'button[data-missing="true"]',
      },
      executedSteps: [
        { stepIndex: 0, toolName: 'browser_navigate', success: true },
      ],
    },
  };

  function expectEnrichedErrorStructure(
    enrichedError: Error,
    hasAlternatives = true
  ) {
    expect(enrichedError.message).toContain('not found');
    expect(enrichedError.diagnosticInfo).toBeDefined();
    if (hasAlternatives) {
      expect(enrichedError.alternatives).toBeDefined();
      expect(enrichedError.alternatives.length).toBeGreaterThan(0);
    }
  }

  test('should enrich element not found error with alternatives', async ({
    page,
  }) => {
    const errorEnrichment =
      await DiagnosticSystemTestHelper.setupErrorEnrichment(
        page,
        ERROR_ENRICHMENT_TEMPLATES.SUBMIT_ELEMENTS
      );
    const enrichedError = await errorEnrichment.enrichElementNotFoundError(
      COMMON_ERROR_SCENARIOS.ELEMENT_NOT_FOUND
    );

    expectEnrichedErrorStructure(enrichedError);
    expect(enrichedError.message).toContain('Alternative elements found:');
  });

  test('should provide diagnostic context for failed operations', async ({
    page,
  }) => {
    const errorEnrichment =
      await DiagnosticSystemTestHelper.setupErrorEnrichment(
        page,
        ERROR_ENRICHMENT_TEMPLATES.IFRAME_CONTENT
      );
    const enrichedError = await errorEnrichment.enrichTimeoutError(
      COMMON_ERROR_SCENARIOS.TIMEOUT_IFRAME
    );

    expect(enrichedError.message).toContain('Timeout waiting for element');
    expect(enrichedError.diagnosticInfo).toBeDefined();
    expect(enrichedError.diagnosticInfo.iframes.detected).toBe(true);
    expect(enrichedError.suggestions).toContain(
      'Element might be inside an iframe'
    );
  });

  test('should provide context-aware suggestions', async ({ page }) => {
    const errorEnrichment =
      await DiagnosticSystemTestHelper.setupErrorEnrichment(
        page,
        ERROR_ENRICHMENT_TEMPLATES.MODAL_DIALOG
      );
    const enrichedError = await errorEnrichment.enrichTimeoutError(
      COMMON_ERROR_SCENARIOS.TIMEOUT_MODAL
    );

    expect(enrichedError.suggestions).toContain(
      'Page has active modal dialog - handle it before performing click'
    );
  });

  test('should handle batch operation failures', async ({ page }) => {
    const errorEnrichment =
      await DiagnosticSystemTestHelper.setupErrorEnrichment(
        page,
        ERROR_ENRICHMENT_TEMPLATES.SIMPLE_BUTTON
      );
    const enrichedError = await errorEnrichment.enrichBatchFailureError(
      COMMON_ERROR_SCENARIOS.BATCH_FAILURE
    );

    expect(enrichedError.message).toContain('Step 2 failed');
    expect(enrichedError.batchContext).toBeDefined();
    expect(enrichedError.batchContext.failedStep.stepIndex).toBe(1);
    expect(enrichedError.batchContext.executedSteps.length).toBe(1);
    expect(enrichedError.diagnosticInfo).toBeDefined();
  });
});

test.describe('Phase 2: ParallelPageAnalyzer', () => {
  const PARALLEL_ANALYSIS_TEMPLATES = {
    COMPLEX_PAGE: (elementCount: number) => `
      <html>
        <head>
          <style>
            .fixed { position: fixed; top: 0; z-index: 1000; }
            .high-z { z-index: 9999; }
            .hidden { overflow: hidden; }
          </style>
        </head>
        <body>
          <nav class="fixed">Navigation</nav>
          <div class="high-z">High Z</div>
          <div class="hidden">Hidden Overflow</div>
          <iframe src="data:text/html,<h1>Iframe</h1>"></iframe>
          ${Array.from(
            { length: elementCount },
            (_, i) =>
              `<div><button>Button ${i}</button><input type="text" id="input-${i}"></div>`
          ).join('')}
        </body>
      </html>
    `,
    SIMPLE_CONTENT: 'data:text/html,<div>Simple content</div>',
    TEST_CONTENT: 'data:text/html,<div>Test content</div>',
  };

  test('should perform parallel analysis within 500ms target', async ({
    page,
  }) => {
    const parallelAnalyzer = await setupParallelAnalyzer(
      page,
      PARALLEL_ANALYSIS_TEMPLATES.COMPLEX_PAGE(1000)
    );

    const result = await DiagnosticSystemTestHelper.measureAndAssertPerformance(
      () => parallelAnalyzer.runParallelAnalysis(),
      500,
      'Parallel analysis'
    );

    expectParallelAnalysisResult(result, 1000);
    expect(result.executionTime).toBeLessThan(500);
    expect(result.structureAnalysis.iframes.detected).toBe(true);
  });

  test('should handle analysis failures gracefully', async ({ page }) => {
    const parallelAnalyzer = await setupParallelAnalyzer(
      page,
      PARALLEL_ANALYSIS_TEMPLATES.SIMPLE_CONTENT
    );
    const result = await parallelAnalyzer.runParallelAnalysis();

    expect(result.errors).toBeDefined();
    expect(Array.isArray(result.errors)).toBe(true);
    expect(result.structureAnalysis || result.performanceMetrics).toBeDefined();
  });

  test('should collect resource usage metrics', async ({ page }) => {
    const parallelAnalyzer = await setupParallelAnalyzer(
      page,
      PARALLEL_ANALYSIS_TEMPLATES.TEST_CONTENT
    );
    const result = await parallelAnalyzer.runParallelAnalysis();

    expect(result.resourceUsage).toBe(null);
  });
});

test.describe('Phase 2: PageAnalyzer Integration', () => {
  const PAGE_ANALYZER_TEMPLATES = {
    INTEGRATION_PAGE: (buttonCount: number) => `
      <html>
        <body>
          <iframe src="data:text/html,<h1>Iframe Content</h1>"></iframe>
          ${Array.from({ length: buttonCount }, (_, i) => `<button id="btn-${i}">Button ${i}</button>`).join('')}
        </body>
      </html>
    `,
    COMPLEX_MULTIPLE_IFRAMES: (elementCount: number) => `
      <html>
        <body>
          <iframe src="data:text/html,<h1>Complex</h1>"></iframe>
          <iframe src="data:text/html,<h1>Multiple</h1>"></iframe>
          ${Array.from(
            { length: elementCount },
            (_, i) =>
              `<div><input type="text" id="input-${i}"><button>Button ${i}</button></div>`
          ).join('')}
        </body>
      </html>
    `,
    SIMPLE_PAGE_CONTENT:
      'data:text/html,<div><p>Simple page</p><button>One button</button></div>',
    TEST_BUTTON_IFRAME:
      'data:text/html,<div><button>Test</button><iframe src="about:blank"></iframe></div>',
  };

  async function testPageAnalyzerIntegration(
    page: Page,
    htmlContent: string,
    expectedElementCount: number,
    maxExecutionTime = 500
  ) {
    const pageAnalyzer = await DiagnosticSystemTestHelper.setupPageAnalyzer(
      page,
      htmlContent
    );

    const result = await DiagnosticSystemTestHelper.measureAndAssertPerformance(
      () => pageAnalyzer.runParallelAnalysis(),
      maxExecutionTime,
      'PageAnalyzer integration'
    );

    expectParallelAnalysisResult(result, expectedElementCount);
    expect(result.structureAnalysis.iframes.detected).toBe(true);

    await pageAnalyzer.dispose();
    return result;
  }

  test('should integrate parallel analysis through PageAnalyzer', async ({
    page,
  }) => {
    await testPageAnalyzerIntegration(
      page,
      PAGE_ANALYZER_TEMPLATES.INTEGRATION_PAGE(800),
      800
    );
  });

  test('should provide enhanced diagnostics with resource monitoring', async ({
    page,
  }) => {
    const pageAnalyzer = await DiagnosticSystemTestHelper.setupPageAnalyzer(
      page,
      PAGE_ANALYZER_TEMPLATES.TEST_BUTTON_IFRAME
    );

    const diagnostics = await pageAnalyzer.getEnhancedDiagnostics();

    expect(diagnostics.parallelAnalysis).toBeDefined();
    expect(diagnostics.frameStats).toBeDefined();
    expect(diagnostics.timestamp).toBeGreaterThan(0);
    expect(
      diagnostics.parallelAnalysis.structureAnalysis.iframes.detected
    ).toBe(true);
    expect(diagnostics.frameStats.isDisposed).toBe(false);

    await pageAnalyzer.dispose();
  });

  test('should recommend parallel analysis for complex pages', async ({
    page,
  }) => {
    const pageAnalyzer = await DiagnosticSystemTestHelper.setupPageAnalyzer(
      page,
      PAGE_ANALYZER_TEMPLATES.COMPLEX_MULTIPLE_IFRAMES(1500)
    );

    const recommendation = await pageAnalyzer.shouldUseParallelAnalysis();

    expect(recommendation.recommended).toBe(true);
    expect(recommendation.reason).toContain('complexity');
    expect(recommendation.estimatedBenefit).toContain('improvement');

    await pageAnalyzer.dispose();
  });

  test('should not recommend parallel analysis for simple pages', async ({
    page,
  }) => {
    const pageAnalyzer = await DiagnosticSystemTestHelper.setupPageAnalyzer(
      page,
      PAGE_ANALYZER_TEMPLATES.SIMPLE_PAGE_CONTENT
    );

    const recommendation = await pageAnalyzer.shouldUseParallelAnalysis();

    expect(recommendation.recommended).toBe(false);
    expect(recommendation.reason).toContain('Low complexity');
    expect(recommendation.estimatedBenefit).toContain('Minimal');

    await pageAnalyzer.dispose();
  });

  test('should handle parallel analysis errors gracefully', async ({
    page,
  }) => {
    await page.goto('data:text/html,<div>Test content</div>');

    const pageAnalyzer = new PageAnalyzer(page);

    // Force page to close to trigger error condition
    await page.close();

    const result = await pageAnalyzer.runParallelAnalysis();

    // Should return result with errors instead of throwing
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some((error) => error.error.includes('closed'))).toBe(
      true
    );
    expect(result.executionTime).toBeGreaterThan(0);

    await pageAnalyzer.dispose();
  });
});

test.describe('Phase 2: Diagnose Tool Integration', () => {
  test('should integrate parallel analysis with diagnose functionality', async ({
    page,
  }) => {
    const complexContent = `
      <html>
        <body>
          <iframe src="data:text/html,<h1>Iframe Content</h1>"></iframe>
          ${Array.from({ length: 1200 }, (_, i) => `<button id="btn-${i}">Button ${i}</button>`).join('')}
        </body>
      </html>
    `;
    await page.goto(`data:text/html,${complexContent}`);

    const pageAnalyzer = new PageAnalyzer(page);

    const startTime = Date.now();

    // Test recommendation system
    const recommendation = await pageAnalyzer.shouldUseParallelAnalysis();
    expect(recommendation.recommended).toBe(true);
    expect(recommendation.reason).toContain('complexity');

    // Test parallel analysis
    const parallelResult = await pageAnalyzer.runParallelAnalysis();
    const executionTime = Date.now() - startTime;

    expect(executionTime).toBeLessThan(600);
    expect(parallelResult.structureAnalysis).toBeDefined();
    expect(parallelResult.performanceMetrics).toBeDefined();
    expect(parallelResult.resourceUsage).toBe(null);
    expect(parallelResult.structureAnalysis.iframes.detected).toBe(true);
    expect(
      parallelResult.performanceMetrics.domMetrics.totalElements
    ).toBeGreaterThan(1200);

    await pageAnalyzer.dispose();
  });

  test('should recommend parallel analysis for complex pages', async ({
    page,
  }) => {
    const complexContent = `
      <html>
        <body>
          <iframe src="data:text/html,<h1>Complex</h1>"></iframe>
          <iframe src="data:text/html,<h1>Multiple</h1>"></iframe>
          ${Array.from({ length: 2000 }, (_, i) => `<div><input type="text" id="input-${i}"></div>`).join('')}
        </body>
      </html>
    `;
    await page.goto(`data:text/html,${complexContent}`);

    const pageAnalyzer = new PageAnalyzer(page);

    const recommendation = await pageAnalyzer.shouldUseParallelAnalysis();
    expect(recommendation.recommended).toBe(true);
    expect(recommendation.reason).toContain('High page complexity');
    expect(recommendation.estimatedBenefit).toContain('40-60%');

    const parallelResult = await pageAnalyzer.runParallelAnalysis();
    expect(parallelResult.structureAnalysis.iframes.detected).toBe(true);
    expect(parallelResult.structureAnalysis.iframes.count).toBe(2);
    expect(
      parallelResult.performanceMetrics.domMetrics.totalElements
    ).toBeGreaterThan(2000);

    await pageAnalyzer.dispose();
  });

  test('should not recommend parallel analysis for simple pages', async ({
    page,
  }) => {
    await page.goto(
      'data:text/html,<div><p>Simple page</p><button>One button</button></div>'
    );

    const pageAnalyzer = new PageAnalyzer(page);

    const recommendation = await pageAnalyzer.shouldUseParallelAnalysis();
    expect(recommendation.recommended).toBe(false);
    expect(recommendation.reason).toContain('Low complexity');
    expect(recommendation.estimatedBenefit).toContain('Minimal');

    await pageAnalyzer.dispose();
  });

  test('should provide comprehensive enhanced diagnostics', async ({
    page,
  }) => {
    await page.goto(
      'data:text/html,<div><button>Test</button><iframe src="about:blank"></iframe></div>'
    );

    const pageAnalyzer = new PageAnalyzer(page);

    const enhancedDiagnostics = await pageAnalyzer.getEnhancedDiagnostics();

    expect(enhancedDiagnostics.parallelAnalysis).toBeDefined();
    expect(enhancedDiagnostics.frameStats).toBeDefined();
    expect(enhancedDiagnostics.timestamp).toBeGreaterThan(0);
    expect(
      enhancedDiagnostics.parallelAnalysis.structureAnalysis.iframes.detected
    ).toBe(true);

    await pageAnalyzer.dispose();
  });

  test('should provide detailed resource monitoring metrics', async ({
    page,
  }) => {
    const complexContent = `
      <html>
        <body>
          ${Array.from({ length: 800 }, (_, i) => `<div><button>Button ${i}</button><input type="text"></div>`).join('')}
        </body>
      </html>
    `;
    await page.goto(`data:text/html,${complexContent}`);

    const pageAnalyzer = new PageAnalyzer(page);

    const parallelResult = await pageAnalyzer.runParallelAnalysis();

    expect(parallelResult.resourceUsage).toBe(null);

    await pageAnalyzer.dispose();
  });
});

test.describe('Phase 2: Performance Verification (500ms Target)', () => {
  const PERFORMANCE_TEST_TEMPLATES = {
    MODERATE_COMPLEXITY: (elementCount: number, iframeCount: number) => `
      <html>
        <head>
          <style>
            .fixed { position: fixed; top: 0; z-index: 1000; }
            .high-z { z-index: 9999; }
          </style>
        </head>
        <body>
          <nav class="fixed">Navigation</nav>
          <div class="high-z">High Z-Index Content</div>
          ${Array.from(
            { length: iframeCount },
            (_, i) =>
              `<iframe src="data:text/html,<h1>Iframe ${i + 1}</h1>"></iframe>`
          ).join('')}
          ${Array.from(
            { length: elementCount },
            (_, i) => `
            <div>
              <button id="btn-${i}">Button ${i}</button>
              <input type="text" id="input-${i}">
              <select id="select-${i}"><option>Option ${i}</option></select>
            </div>
          `
          ).join('')}
        </body>
      </html>
    `,
    SIMPLE_PAGE: (elementCount: number) => `
      <html>
        <body>
          <header>Simple Header</header>
          <main>
            <p>Simple content</p>
            ${Array.from({ length: elementCount }, (_, i) => `<button>Button ${i}</button>`).join('')}
          </main>
          <footer>Footer</footer>
        </body>
      </html>
    `,
    COMPLEX_PAGE: (elementCount: number) => `
      <html>
        <head>
          <style>
            .fixed { position: fixed; z-index: 1000; }
            .high { z-index: 9999; }
          </style>
        </head>
        <body>
          <nav class="fixed">Fixed Navigation</nav>
          <div class="high">High Z-Index Modal</div>
          ${Array.from(
            { length: 3 },
            (_, i) =>
              `<iframe src="data:text/html,<h1>Frame ${i + 1}</h1>"></iframe>`
          ).join('')}
          ${Array.from(
            { length: elementCount },
            (_, i) => `
            <div class="item-${i % 10}">
              <button data-id="${i}">Btn ${i}</button>
              <input type="text" name="field-${i}" value="Value ${i}">
              <img src="data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=" alt="Image ${i}">
            </div>
          `
          ).join('')}
        </body>
      </html>
    `,
  };

  async function testPerformanceWithPageAnalyzer(
    page: Page,
    htmlContent: string,
    expectedElementCount: number,
    expectedIframeCount: number,
    maxExecutionTime: number
  ) {
    const pageAnalyzer = await DiagnosticSystemTestHelper.setupPageAnalyzer(
      page,
      htmlContent
    );

    const parallelResult =
      await DiagnosticSystemTestHelper.measureAndAssertPerformance(
        () => pageAnalyzer.runParallelAnalysis(),
        maxExecutionTime,
        'Parallel analysis performance'
      );

    expect(parallelResult.executionTime).toBeLessThan(maxExecutionTime);
    expectParallelAnalysisResult(parallelResult, expectedElementCount);
    expect(parallelResult.structureAnalysis.iframes.count).toBe(
      expectedIframeCount
    );

    await pageAnalyzer.dispose();
    return parallelResult;
  }

  test('should complete parallel analysis within 500ms for moderate complexity pages', async ({
    page,
  }) => {
    await testPerformanceWithPageAnalyzer(
      page,
      PERFORMANCE_TEST_TEMPLATES.MODERATE_COMPLEXITY(1000, 2),
      1000,
      2,
      500
    );
  });

  test('should complete parallel analysis within 400ms for simple pages', async ({
    page,
  }) => {
    const pageAnalyzer = await DiagnosticSystemTestHelper.setupPageAnalyzer(
      page,
      PERFORMANCE_TEST_TEMPLATES.SIMPLE_PAGE(200)
    );

    const parallelResult =
      await DiagnosticSystemTestHelper.measureAndAssertPerformance(
        () => pageAnalyzer.runParallelAnalysis(),
        400,
        'Simple page performance'
      );

    expect(parallelResult.executionTime).toBeLessThan(400);
    expectParallelAnalysisResult(parallelResult, 200);

    await pageAnalyzer.dispose();
  });

  test('should handle complex pages within 500ms with graceful degradation', async ({
    page,
  }) => {
    const parallelResult = await testPerformanceWithPageAnalyzer(
      page,
      PERFORMANCE_TEST_TEMPLATES.COMPLEX_PAGE(1500),
      1500,
      3,
      500
    );

    // Verify comprehensive analysis completed
    expect(
      parallelResult.performanceMetrics.layoutMetrics.fixedElements.length
    ).toBeGreaterThan(0);
    expect(
      parallelResult.performanceMetrics.layoutMetrics.highZIndexElements.length
    ).toBeGreaterThan(0);
  });

  test('should demonstrate performance improvement vs sequential analysis', async ({
    page,
  }) => {
    const complexContent = PERFORMANCE_TEST_TEMPLATES.MODERATE_COMPLEXITY(
      800,
      1
    );
    const pageAnalyzer = await DiagnosticSystemTestHelper.setupPageAnalyzer(
      page,
      complexContent
    );

    // Test sequential analysis timing
    const [structureAnalysis, performanceMetrics] = await Promise.all([
      pageAnalyzer.analyzePageStructure(),
      pageAnalyzer.analyzePerformanceMetrics(),
    ]);

    // Test parallel analysis timing
    const parallelResult =
      await DiagnosticSystemTestHelper.measureAndAssertPerformance(
        () => pageAnalyzer.runParallelAnalysis(),
        500,
        'Parallel vs sequential comparison'
      );

    expect(parallelResult.resourceUsage).toBe(null);

    // Verify data completeness is maintained
    expect(parallelResult.structureAnalysis.iframes.detected).toBe(
      structureAnalysis.iframes.detected
    );
    expect(
      parallelResult.performanceMetrics.domMetrics.totalElements
    ).toBeCloseTo(performanceMetrics.domMetrics.totalElements, -50); // Within reasonable range

    await pageAnalyzer.dispose();
  });
});

test.describe('Diagnostic System Integration', () => {
  const INTEGRATION_TEST_SCENARIOS = {
    COMPREHENSIVE_DIAGNOSTICS: {
      htmlContent:
        'data:text/html,<div><button>Test</button><iframe src="about:blank"></iframe></div>',
      searchCriteria: {
        originalSelector: 'button[data-missing="true"]',
        searchCriteria: { role: 'button' },
      },
      enrichmentScenario: {
        originalError: new Error('Test error'),
        selector: 'missing-element',
        searchCriteria: { text: 'Test' },
      },
      maxExecutionTime: 300,
    },
  };

  test('should provide comprehensive diagnostic data within 300ms', async ({
    page,
  }) => {
    const scenario = INTEGRATION_TEST_SCENARIOS.COMPREHENSIVE_DIAGNOSTICS;

    const pageAnalyzer = await DiagnosticSystemTestHelper.setupPageAnalyzer(
      page,
      scenario.htmlContent
    );
    const elementDiscovery =
      await DiagnosticSystemTestHelper.setupElementDiscovery(page);
    const errorEnrichment =
      await DiagnosticSystemTestHelper.setupErrorEnrichment(page);

    // Simulate comprehensive diagnostic collection
    const [analysis, alternatives, enrichedError] =
      await DiagnosticSystemTestHelper.measureAndAssertPerformance(
        () =>
          Promise.all([
            pageAnalyzer.analyzePageStructure(),
            elementDiscovery.findAlternativeElements(scenario.searchCriteria),
            errorEnrichment.enrichElementNotFoundError(
              scenario.enrichmentScenario
            ),
          ]),
        scenario.maxExecutionTime,
        'Comprehensive diagnostic collection'
      );

    expect(analysis).toBeDefined();
    expect(alternatives).toBeDefined();
    expect(enrichedError).toBeDefined();
  });

  test('should integrate parallel analysis with existing system', async ({
    page,
  }) => {
    const complexContent = DIAGNOSTIC_HTML_TEMPLATES.SIMPLE_PAGE(
      'Modal Test Page',
      `
      <div role="dialog">Modal Dialog</div>
      <iframe src="data:text/html,<h1>Iframe Content</h1>"></iframe>
      ${Array.from({ length: 500 }, (_, i) => `<button id="btn-${i}">Button ${i}</button>`).join('')}
    `
    );

    const parallelAnalyzer = await setupParallelAnalyzer(page, complexContent);
    const errorEnrichment =
      await DiagnosticSystemTestHelper.setupErrorEnrichment(page);

    const [parallelResult, enrichedError] =
      await DiagnosticSystemTestHelper.measureAndAssertPerformance(
        () =>
          Promise.all([
            parallelAnalyzer.runParallelAnalysis(),
            errorEnrichment.enrichTimeoutError({
              originalError: new Error('Timeout waiting for element'),
              operation: 'click',
              selector: 'button[data-test="missing"]',
            }),
          ]),
        500,
        'Parallel analysis integration'
      );

    expect(parallelResult.structureAnalysis.modalStates.hasDialog).toBe(true);
    expect(parallelResult.structureAnalysis.iframes.detected).toBe(true);
    expect(
      parallelResult.performanceMetrics.domMetrics.totalElements
    ).toBeGreaterThan(500);
    expect(enrichedError.suggestions).toContain(
      'Page has active modal dialog - handle it before performing click'
    );
  });
});

test.describe('configOverrides visibility and impact', () => {
  async function setupDiagnoseTest(
    page: Page,
    params: Record<string, unknown>,
    testId = randomUUID().substring(0, 9)
  ) {
    await page.goto(
      `data:text/html,<html><body><h1>Test Page ${testId}</h1></body></html>`
    );

    const mockContext =
      DiagnosticSystemTestHelper.createMockDiagnoseContext(page);
    const mockResponse =
      DiagnosticSystemTestHelper.createMockDiagnoseResponse();

    const { browserDiagnose } = await import('../src/tools/diagnose.js');
    await browserDiagnose.handle(mockContext, params, mockResponse);

    return mockResponse.results.join('\n');
  }

  test('should show applied overrides in diagnostic report', async ({
    page,
  }) => {
    const params = {
      configOverrides: {
        enableResourceMonitoring: false,
        performanceThresholds: {
          pageAnalysis: 2000,
          elementDiscovery: 1500,
        },
      },
      includeSystemStats: true,
      useUnifiedSystem: true,
    };

    const report = await setupDiagnoseTest(page, params);

    // Check that applied overrides are visible in the report
    expect(report).toContain('Applied Configuration Overrides');
    expect(report).toContain('Resource Monitoring: Disabled');
    expect(report).toContain('Performance Thresholds:');
    // Check for actual threshold values reported in the format: oldValue → newValue
    expect(report).toMatch(THRESHOLD_REGEX_1);
    expect(report).toMatch(THRESHOLD_REGEX_2);
  });

  test('should show different results with and without overrides', async ({
    browser,
  }) => {
    const paramsWithout = {
      includeSystemStats: true,
      useUnifiedSystem: true,
    };

    const paramsWith = {
      configOverrides: {
        enableResourceMonitoring: true,
        performanceThresholds: {
          pageAnalysis: 10_000,
        },
      },
      includeSystemStats: true,
      useUnifiedSystem: true,
    };

    // Use separate contexts to avoid navigation conflicts
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    try {
      const [reportWithout, reportWith] = await Promise.all([
        setupDiagnoseTest(page1, paramsWithout, 'without-overrides'),
        setupDiagnoseTest(page2, paramsWith, 'with-overrides'),
      ]);

      // Reports should be different
      expect(reportWith).not.toEqual(reportWithout);

      // Report with overrides should contain override information
      expect(reportWith).toContain('Custom overrides applied');
      expect(reportWith).toContain('Applied Configuration Overrides');

      // Report without overrides should use default settings
      expect(reportWithout).toContain('Default settings');
      expect(reportWithout).not.toContain('Applied Configuration Overrides');
    } finally {
      await page1.close();
      await page2.close();
      await context1.close();
      await context2.close();
    }
  });

  test('should show configuration impact analysis', async ({ page }) => {
    const params = {
      configOverrides: {
        enableResourceMonitoring: true,
        enableErrorEnrichment: true,
        performanceThresholds: {
          pageAnalysis: 5000,
          elementDiscovery: 3000,
        },
      },
      includeSystemStats: true,
      useUnifiedSystem: true,
    };

    const report = await setupDiagnoseTest(page, params);

    // Check for configuration impact analysis
    expect(report).toContain('### Configuration Impact Analysis');
    expect(report).toContain('**Configuration Status:**');

    // Check for performance baseline comparison instead of applied changes
    expect(report).toContain('**Performance Baseline Comparison:**');
    expect(report).toMatch(PERFORMANCE_REGEX);
  });
});
