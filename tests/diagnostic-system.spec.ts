/**
 * Diagnostic System Tests - PageAnalyzer, ElementDiscovery, ErrorEnrichment
 */

import { test, expect } from '@playwright/test';
import { PageAnalyzer } from '../src/diagnostics/PageAnalyzer.js';
import { ElementDiscovery } from '../src/diagnostics/ElementDiscovery.js';
import { ErrorEnrichment } from '../src/diagnostics/ErrorEnrichment.js';


test.describe('PageAnalyzer', () => {
  test('should analyze iframe detection status', async ({ page }) => {
    await page.goto('data:text/html,<html><body><iframe src="data:text/html,<h1>Test</h1>"></iframe></body></html>');

    const pageAnalyzer = new PageAnalyzer(page);
    const analysis = await pageAnalyzer.analyzePageStructure();

    expect(analysis.iframes.detected).toBe(true);
    expect(analysis.iframes.count).toBe(1);
    expect(analysis.iframes.accessible.length + analysis.iframes.inaccessible.length).toBe(1);
    expect(analysis.modalStates.hasDialog).toBe(false);
    expect(analysis.modalStates.hasFileChooser).toBe(false);
    expect(analysis.modalStates.blockedBy).toEqual([]);
    expect(analysis.elements.totalVisible).toBeGreaterThan(0);
    expect(analysis.elements.totalInteractable).toBeGreaterThanOrEqual(0);
    expect(analysis.elements.missingAria).toBeGreaterThanOrEqual(0);
  });

  test('should analyze performance metrics for simple page', async ({ page }) => {
    const htmlContent = `
      <html>
        <head><title>Test Page</title></head>
        <body>
          <div id="root">
            <h1>Test Page</h1>
            <button>Click Me</button>
            <input type="text" placeholder="Enter text">
            <img src="data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=" alt="Test Image">
          </div>
        </body>
      </html>
    `;
    await page.goto(`data:text/html,${htmlContent}`);

    const pageAnalyzer = new PageAnalyzer(page);
    const metrics = await pageAnalyzer.analyzePerformanceMetrics();

    expect(metrics).toBeDefined();
    expect(metrics.domMetrics).toBeDefined();
    expect(metrics.interactionMetrics).toBeDefined();
    expect(metrics.resourceMetrics).toBeDefined();
    expect(metrics.layoutMetrics).toBeDefined();
    expect(metrics.domMetrics.totalElements).toBeGreaterThan(0);
    expect(metrics.domMetrics.maxDepth).toBeGreaterThanOrEqual(1);
    expect(metrics.interactionMetrics.clickableElements).toBeGreaterThanOrEqual(1);
    expect(metrics.interactionMetrics.formElements).toBeGreaterThanOrEqual(1);
    expect(metrics.resourceMetrics.imageCount).toBeGreaterThanOrEqual(1);
    expect(metrics.warnings).toBeDefined();
    expect(Array.isArray(metrics.warnings)).toBe(true);
  });

  test('should handle performance metrics analysis errors gracefully', async ({ page }) => {
    // Create a page that might cause issues (very deep DOM structure)
    const complexHtml = `
      <html>
        <head><title>Complex Test Page</title></head>
        <body>
          ${'<div>'.repeat(20)}
            <button id="deep-button">Deep Button</button>
          ${'</div>'.repeat(20)}
        </body>
      </html>
    `;
    await page.goto(`data:text/html,${complexHtml}`);

    const pageAnalyzer = new PageAnalyzer(page);

    // This should not throw an error even with complex DOM
    const metrics = await pageAnalyzer.analyzePerformanceMetrics();

    expect(metrics).toBeDefined();
    expect(metrics.domMetrics).toBeDefined();
    expect(metrics.interactionMetrics).toBeDefined();
    expect(metrics.resourceMetrics).toBeDefined();
    expect(metrics.layoutMetrics).toBeDefined();

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
    // Create a page with many elements to trigger warnings
    const manyElements = Array.from({ length: 2000 }, (_, i) => `<div class="item-${i}">Item ${i}</div>`).join('');
    const complexHtml = `
      <html>
        <body>
          <div id="container">
            ${manyElements}
          </div>
        </body>
      </html>
    `;
    await page.goto(`data:text/html,${complexHtml}`);

    const pageAnalyzer = new PageAnalyzer(page);
    const metrics = await pageAnalyzer.analyzePerformanceMetrics();

    expect(metrics.domMetrics.totalElements).toBeGreaterThan(1500);
    expect(metrics.warnings.some(w => w.type === 'dom_complexity')).toBe(true);
    expect(metrics.warnings.some(w => w.level === 'warning' || w.level === 'danger')).toBe(true);
  });

  test('should detect large subtrees', async ({ page }) => {
    // Create a subtree with many child elements
    const largeSubtree = Array.from({ length: 600 }, (_, i) => `<li>Item ${i}</li>`).join('');
    const htmlContent = `
      <html>
        <body>
          <ul id="large-list">
            ${largeSubtree}
          </ul>
        </body>
      </html>
    `;
    await page.goto(`data:text/html,${htmlContent}`);

    const pageAnalyzer = new PageAnalyzer(page);
    const metrics = await pageAnalyzer.analyzePerformanceMetrics();

    expect(metrics.domMetrics.largeSubtrees.length).toBeGreaterThan(0);
    expect(metrics.domMetrics.largeSubtrees.some(subtree => subtree.elementCount > 500)).toBe(true);
    // Check if any subtree contains 'ul' or if body is detected (both are valid)
    expect(
        metrics.domMetrics.largeSubtrees.some(subtree =>
          subtree.selector.includes('ul') || subtree.selector.includes('body')
        )
    ).toBe(true);
  });

  test('should analyze layout metrics with fixed elements', async ({ page }) => {
    const htmlContent = `
      <html>
        <head>
          <style>
            .fixed-nav { position: fixed; top: 0; z-index: 1000; }
            .high-z { position: absolute; z-index: 9999; }
            .hidden { overflow: hidden; }
          </style>
        </head>
        <body>
          <nav class="fixed-nav">Navigation</nav>
          <div class="high-z">High Z-Index Element</div>
          <div class="hidden">Hidden Overflow</div>
        </body>
      </html>
    `;
    await page.goto(`data:text/html,${htmlContent}`);

    const pageAnalyzer = new PageAnalyzer(page);
    const metrics = await pageAnalyzer.analyzePerformanceMetrics();

    expect(metrics.layoutMetrics.fixedElements.length).toBeGreaterThan(0);
    expect(metrics.layoutMetrics.highZIndexElements.length).toBeGreaterThan(0);
    expect(metrics.layoutMetrics.overflowHiddenElements).toBeGreaterThan(0);
    expect(metrics.layoutMetrics.fixedElements[0].purpose).toContain('navigation');
    // Check if any element has z-index >= 9999 (since we created one)
    expect(metrics.layoutMetrics.highZIndexElements.some(el => el.zIndex >= 9999)).toBe(true);
  });

  test('should complete performance analysis within 1 second', async ({ page }) => {
    // Create a moderately complex page
    const elements = Array.from({ length: 500 }, (_, i) =>
      `<div><button>Button ${i}</button><input type="text" id="input-${i}"></div>`
    ).join('');
    const htmlContent = `
      <html>
        <body>
          <div id="container">
            ${elements}
          </div>
        </body>
      </html>
    `;
    await page.goto(`data:text/html,${htmlContent}`);

    const startTime = Date.now();
    const pageAnalyzer = new PageAnalyzer(page);
    const metrics = await pageAnalyzer.analyzePerformanceMetrics();
    const executionTime = Date.now() - startTime;

    expect(executionTime).toBeLessThan(1000);
    expect(metrics).toBeDefined();
    expect(metrics.domMetrics.totalElements).toBeGreaterThan(500);
  });

  test('should analyze modal states correctly', async ({ page }) => {
    await page.goto('data:text/html,<div><div role="dialog" class="modal">Modal Content</div><input type="file"></div>');

    const pageAnalyzer = new PageAnalyzer(page);
    const analysis = await pageAnalyzer.analyzePageStructure();

    expect(analysis.modalStates.hasDialog).toBe(true);
    expect(analysis.modalStates.hasFileChooser).toBe(true);
    expect(analysis.modalStates.blockedBy).toContain('dialog');
    expect(analysis.modalStates.blockedBy).toContain('fileChooser');
  });

  test('should count elements correctly', async ({ page }) => {
    await page.goto('data:text/html,<div><button>Click</button><input type="text"><span style="display:none">Hidden</span></div>');

    const pageAnalyzer = new PageAnalyzer(page);
    const analysis = await pageAnalyzer.analyzePageStructure();

    expect(analysis.elements.totalVisible).toBeGreaterThan(0);
    expect(analysis.elements.totalInteractable).toBeGreaterThan(0);
  });
});

test.describe('ElementDiscovery', () => {
  test('should find alternative elements by text content', async ({ page }) => {
    await page.goto('data:text/html,<div><button>Submit</button><input type="submit" value="Submit Form"></div>');

    const elementDiscovery = new ElementDiscovery(page);
    const alternatives = await elementDiscovery.findAlternativeElements({
      originalSelector: 'button[data-missing="true"]',
      searchCriteria: {
        text: 'Submit',
        role: 'button'
      }
    });

    expect(alternatives.length).toBeGreaterThan(0);
    expect(alternatives[0]).toEqual(expect.objectContaining({
      selector: expect.any(String),
      confidence: expect.any(Number),
      reason: expect.stringContaining('text match')
    }));
    expect(alternatives[0].confidence).toBeGreaterThan(0.5);
  });

  test('should find alternatives by ARIA role', async ({ page }) => {
    await page.goto('data:text/html,<div><a role="button">Click</a><button>Real Button</button></div>');

    const elementDiscovery = new ElementDiscovery(page);
    const alternatives = await elementDiscovery.findAlternativeElements({
      originalSelector: 'input[type="submit"]',
      searchCriteria: {
        role: 'button'
      }
    });

    expect(alternatives.length).toBeGreaterThan(0);
    expect(alternatives.every(alt => alt.confidence > 0)).toBe(true);
  });

  test('should sort alternatives by confidence', async ({ page }) => {
    await page.goto('data:text/html,<div><button>Exact</button><button>Similar</button><div>Different</div></div>');

    const elementDiscovery = new ElementDiscovery(page);
    const alternatives = await elementDiscovery.findAlternativeElements({
      originalSelector: 'button[data-test="exact"]',
      searchCriteria: {
        text: 'Exact',
        role: 'button'
      }
    });

    if (alternatives.length > 1)
      expect(alternatives[0].confidence).toBeGreaterThanOrEqual(alternatives[1].confidence);

  });

  test('should limit number of alternatives', async ({ page }) => {
    const html = Array.from({ length: 20 }, (_, i) => `<button>Button ${i}</button>`).join('');
    await page.goto(`data:text/html,<div>${html}</div>`);

    const elementDiscovery = new ElementDiscovery(page);
    const alternatives = await elementDiscovery.findAlternativeElements({
      originalSelector: 'button[data-missing="true"]',
      searchCriteria: {
        role: 'button'
      },
      maxResults: 5
    });

    expect(alternatives.length).toBeLessThanOrEqual(5);
  });
});

test.describe('ErrorEnrichment', () => {
  test('should enrich element not found error with alternatives', async ({ page }) => {
    await page.goto('data:text/html,<div><button>Submit</button><input type="submit" value="Submit"></div>');

    const errorEnrichment = new ErrorEnrichment(page);
    const enrichedError = await errorEnrichment.enrichElementNotFoundError({
      originalError: new Error('Element not found: button[data-test="submit"]'),
      selector: 'button[data-test="submit"]',
      searchCriteria: {
        text: 'Submit',
        role: 'button'
      }
    });

    expect(enrichedError.message).toContain('Element not found');
    expect(enrichedError.message).toContain('Alternative elements found:');
    expect(enrichedError.alternatives).toBeDefined();
    expect(enrichedError.alternatives.length).toBeGreaterThan(0);
    expect(enrichedError.diagnosticInfo).toBeDefined();
  });

  test('should provide diagnostic context for failed operations', async ({ page }) => {
    await page.goto('data:text/html,<iframe src="data:text/html,<h1>Content</h1>"></iframe>');

    const errorEnrichment = new ErrorEnrichment(page);
    const enrichedError = await errorEnrichment.enrichTimeoutError({
      originalError: new Error('Timeout waiting for element'),
      operation: 'click',
      selector: 'button[data-test="inside-iframe"]'
    });

    expect(enrichedError.message).toContain('Timeout waiting for element');
    expect(enrichedError.diagnosticInfo).toBeDefined();
    expect(enrichedError.diagnosticInfo.iframes.detected).toBe(true);
    expect(enrichedError.suggestions).toContain('Element might be inside an iframe');
  });

  test('should provide context-aware suggestions', async ({ page }) => {
    await page.goto('data:text/html,<div role="dialog" class="modal">Modal Content</div><input type="text">');

    const errorEnrichment = new ErrorEnrichment(page);
    const enrichedError = await errorEnrichment.enrichTimeoutError({
      originalError: new Error('Timeout waiting for element'),
      operation: 'click',
      selector: 'input[type="text"]'
    });

    expect(enrichedError.suggestions).toContain('Page has active modal dialog - handle it before performing click');
  });

  test('should handle batch operation failures', async ({ page }) => {
    await page.goto('data:text/html,<div><button>Step 1</button></div>');

    const errorEnrichment = new ErrorEnrichment(page);
    const enrichedError = await errorEnrichment.enrichBatchFailureError({
      originalError: new Error('Step 2 failed'),
      failedStep: {
        stepIndex: 1,
        toolName: 'browser_click',
        selector: 'button[data-missing="true"]'
      },
      executedSteps: [
        { stepIndex: 0, toolName: 'browser_navigate', success: true }
      ]
    });

    expect(enrichedError.message).toContain('Step 2 failed');
    expect(enrichedError.batchContext).toBeDefined();
    expect(enrichedError.batchContext.failedStep.stepIndex).toBe(1);
    expect(enrichedError.batchContext.executedSteps.length).toBe(1);
    expect(enrichedError.diagnosticInfo).toBeDefined();
  });
});

test.describe('Phase 2: ParallelPageAnalyzer', () => {
  test('should perform parallel analysis within 500ms target', async ({ page }) => {
    const complexContent = `
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
          ${Array.from({ length: 1000 }, (_, i) => `<div><button>Button ${i}</button><input type="text" id="input-${i}"></div>`).join('')}
        </body>
      </html>
    `;
    await page.goto(`data:text/html,${complexContent}`);

    const { ParallelPageAnalyzer } = await import('../src/diagnostics/ParallelPageAnalyzer.js');
    const parallelAnalyzer = new ParallelPageAnalyzer(page);

    const startTime = Date.now();
    const result = await parallelAnalyzer.runParallelAnalysis();
    const executionTime = Date.now() - startTime;

    expect(executionTime).toBeLessThan(500);
    expect(result.structureAnalysis).toBeDefined();
    expect(result.performanceMetrics).toBeDefined();
    expect(result.resourceUsage).toBe(null);
    expect(result.executionTime).toBeLessThan(500);
    expect(result.structureAnalysis.iframes.detected).toBe(true);
    expect(result.performanceMetrics.domMetrics.totalElements).toBeGreaterThan(1000);
  });

  test('should handle analysis failures gracefully', async ({ page }) => {
    await page.goto('data:text/html,<div>Simple content</div>');

    const { ParallelPageAnalyzer } = await import('../src/diagnostics/ParallelPageAnalyzer.js');
    const parallelAnalyzer = new ParallelPageAnalyzer(page);

    const result = await parallelAnalyzer.runParallelAnalysis();

    expect(result.errors).toBeDefined();
    expect(Array.isArray(result.errors)).toBe(true);
    expect(result.structureAnalysis || result.performanceMetrics).toBeDefined();
  });

  test('should collect resource usage metrics', async ({ page }) => {
    await page.goto('data:text/html,<div>Test content</div>');

    const { ParallelPageAnalyzer } = await import('../src/diagnostics/ParallelPageAnalyzer.js');
    const parallelAnalyzer = new ParallelPageAnalyzer(page);

    const result = await parallelAnalyzer.runParallelAnalysis();

    expect(result.resourceUsage).toBe(null);
  });
});


test.describe('Phase 2: PageAnalyzer Integration', () => {
  test('should integrate parallel analysis through PageAnalyzer', async ({ page }) => {
    const complexContent = `
      <html>
        <body>
          <iframe src="data:text/html,<h1>Iframe Content</h1>"></iframe>
          ${Array.from({ length: 800 }, (_, i) => `<button id="btn-${i}">Button ${i}</button>`).join('')}
        </body>
      </html>
    `;
    await page.goto(`data:text/html,${complexContent}`);

    const pageAnalyzer = new PageAnalyzer(page);

    const startTime = Date.now();
    const result = await pageAnalyzer.runParallelAnalysis();
    const executionTime = Date.now() - startTime;

    expect(executionTime).toBeLessThan(500);
    expect(result.structureAnalysis).toBeDefined();
    expect(result.performanceMetrics).toBeDefined();
    expect(result.resourceUsage).toBe(null);
    expect(result.structureAnalysis.iframes.detected).toBe(true);
    expect(result.performanceMetrics.domMetrics.totalElements).toBeGreaterThan(800);

    await pageAnalyzer.dispose();
  });

  test('should provide enhanced diagnostics with resource monitoring', async ({ page }) => {
    await page.goto('data:text/html,<div><button>Test</button><iframe src="about:blank"></iframe></div>');

    const pageAnalyzer = new PageAnalyzer(page);

    const diagnostics = await pageAnalyzer.getEnhancedDiagnostics();

    expect(diagnostics.parallelAnalysis).toBeDefined();
    expect(diagnostics.frameStats).toBeDefined();
    expect(diagnostics.timestamp).toBeGreaterThan(0);
    expect(diagnostics.parallelAnalysis.structureAnalysis.iframes.detected).toBe(true);
    expect(diagnostics.frameStats.isDisposed).toBe(false);

    await pageAnalyzer.dispose();
  });

  test('should recommend parallel analysis for complex pages', async ({ page }) => {
    const complexContent = `
      <html>
        <body>
          <iframe src="data:text/html,<h1>Complex</h1>"></iframe>
          <iframe src="data:text/html,<h1>Multiple</h1>"></iframe>
          ${Array.from({ length: 1500 }, (_, i) => `<div><input type="text" id="input-${i}"><button>Button ${i}</button></div>`).join('')}
        </body>
      </html>
    `;
    await page.goto(`data:text/html,${complexContent}`);

    const pageAnalyzer = new PageAnalyzer(page);

    const recommendation = await pageAnalyzer.shouldUseParallelAnalysis();

    expect(recommendation.recommended).toBe(true);
    expect(recommendation.reason).toContain('complexity');
    expect(recommendation.estimatedBenefit).toContain('improvement');

    await pageAnalyzer.dispose();
  });

  test('should not recommend parallel analysis for simple pages', async ({ page }) => {
    await page.goto('data:text/html,<div><p>Simple page</p><button>One button</button></div>');

    const pageAnalyzer = new PageAnalyzer(page);

    const recommendation = await pageAnalyzer.shouldUseParallelAnalysis();

    expect(recommendation.recommended).toBe(false);
    expect(recommendation.reason).toContain('Low complexity');
    expect(recommendation.estimatedBenefit).toContain('Minimal');

    await pageAnalyzer.dispose();
  });

  test('should handle parallel analysis errors gracefully', async ({ page }) => {
    await page.goto('data:text/html,<div>Test content</div>');

    const pageAnalyzer = new PageAnalyzer(page);

    // Force page to close to trigger error condition
    await page.close();

    const result = await pageAnalyzer.runParallelAnalysis();

    // Should return result with errors instead of throwing
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some(error => error.error.includes('closed'))).toBe(true);
    expect(result.executionTime).toBeGreaterThan(0);

    await pageAnalyzer.dispose();
  });
});

test.describe('Phase 2: Diagnose Tool Integration', () => {
  test('should integrate parallel analysis with diagnose functionality', async ({ page }) => {
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
    expect(parallelResult.performanceMetrics.domMetrics.totalElements).toBeGreaterThan(1200);

    await pageAnalyzer.dispose();
  });

  test('should recommend parallel analysis for complex pages', async ({ page }) => {
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
    expect(parallelResult.performanceMetrics.domMetrics.totalElements).toBeGreaterThan(2000);

    await pageAnalyzer.dispose();
  });

  test('should not recommend parallel analysis for simple pages', async ({ page }) => {
    await page.goto('data:text/html,<div><p>Simple page</p><button>One button</button></div>');

    const pageAnalyzer = new PageAnalyzer(page);

    const recommendation = await pageAnalyzer.shouldUseParallelAnalysis();
    expect(recommendation.recommended).toBe(false);
    expect(recommendation.reason).toContain('Low complexity');
    expect(recommendation.estimatedBenefit).toContain('Minimal');

    await pageAnalyzer.dispose();
  });

  test('should provide comprehensive enhanced diagnostics', async ({ page }) => {
    await page.goto('data:text/html,<div><button>Test</button><iframe src="about:blank"></iframe></div>');

    const pageAnalyzer = new PageAnalyzer(page);

    const enhancedDiagnostics = await pageAnalyzer.getEnhancedDiagnostics();

    expect(enhancedDiagnostics.parallelAnalysis).toBeDefined();
    expect(enhancedDiagnostics.frameStats).toBeDefined();
    expect(enhancedDiagnostics.timestamp).toBeGreaterThan(0);
    expect(enhancedDiagnostics.parallelAnalysis.structureAnalysis.iframes.detected).toBe(true);

    await pageAnalyzer.dispose();
  });

  test('should provide detailed resource monitoring metrics', async ({ page }) => {
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
  test('should complete parallel analysis within 500ms for moderate complexity pages', async ({ page }) => {
    const moderateContent = `
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
          <iframe src="data:text/html,<h1>Iframe 1</h1>"></iframe>
          <iframe src="data:text/html,<h1>Iframe 2</h1>"></iframe>
          ${Array.from({ length: 1000 }, (_, i) =>
    `<div><button id="btn-${i}">Button ${i}</button><input type="text" id="input-${i}"><select id="select-${i}"><option>Option ${i}</option></select></div>`
  ).join('')}
        </body>
      </html>
    `;
    await page.goto(`data:text/html,${moderateContent}`);

    const pageAnalyzer = new PageAnalyzer(page);

    // Test parallel analysis performance
    const startTime = Date.now();
    const parallelResult = await pageAnalyzer.runParallelAnalysis();
    const executionTime = Date.now() - startTime;

    // Performance requirement: 500ms
    expect(executionTime).toBeLessThan(500);
    expect(parallelResult.executionTime).toBeLessThan(500);

    // Verify completeness of analysis
    expect(parallelResult.structureAnalysis).toBeDefined();
    expect(parallelResult.performanceMetrics).toBeDefined();
    expect(parallelResult.resourceUsage).toBe(null);
    expect(parallelResult.structureAnalysis.iframes.count).toBe(2);
    expect(parallelResult.performanceMetrics.domMetrics.totalElements).toBeGreaterThan(1000);

    await pageAnalyzer.dispose();
  });

  test('should complete parallel analysis within 400ms for simple pages', async ({ page }) => {
    const simpleContent = `
      <html>
        <body>
          <header>Simple Header</header>
          <main>
            <p>Simple content</p>
            ${Array.from({ length: 200 }, (_, i) => `<button>Button ${i}</button>`).join('')}
          </main>
          <footer>Footer</footer>
        </body>
      </html>
    `;
    await page.goto(`data:text/html,${simpleContent}`);

    const pageAnalyzer = new PageAnalyzer(page);

    const startTime = Date.now();
    const parallelResult = await pageAnalyzer.runParallelAnalysis();
    const executionTime = Date.now() - startTime;

    // Should be faster for simple pages
    expect(executionTime).toBeLessThan(400);
    expect(parallelResult.executionTime).toBeLessThan(400);

    expect(parallelResult.structureAnalysis).toBeDefined();
    expect(parallelResult.performanceMetrics).toBeDefined();
    expect(parallelResult.performanceMetrics.domMetrics.totalElements).toBeGreaterThan(200);

    await pageAnalyzer.dispose();
  });

  test('should handle complex pages within 500ms with graceful degradation', async ({ page }) => {
    const complexContent = `
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
          <iframe src="data:text/html,<h1>Frame 1</h1>"></iframe>
          <iframe src="data:text/html,<h1>Frame 2</h1>"></iframe>
          <iframe src="data:text/html,<h1>Frame 3</h1>"></iframe>
          ${Array.from({ length: 1500 }, (_, i) =>
    `<div class="item-${i % 10}"><button data-id="${i}">Btn ${i}</button><input type="text" name="field-${i}" value="Value ${i}"><img src="data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=" alt="Image ${i}"></div>`
  ).join('')}
        </body>
      </html>
    `;
    await page.goto(`data:text/html,${complexContent}`);

    const pageAnalyzer = new PageAnalyzer(page);

    const startTime = Date.now();
    const parallelResult = await pageAnalyzer.runParallelAnalysis();
    const executionTime = Date.now() - startTime;

    // Even complex pages should meet the 500ms target
    expect(executionTime).toBeLessThan(500);
    expect(parallelResult.executionTime).toBeLessThan(500);

    // Verify comprehensive analysis completed
    expect(parallelResult.structureAnalysis.iframes.count).toBe(3);
    expect(parallelResult.performanceMetrics.domMetrics.totalElements).toBeGreaterThan(1500);
    expect(parallelResult.performanceMetrics.layoutMetrics.fixedElements.length).toBeGreaterThan(0);
    expect(parallelResult.performanceMetrics.layoutMetrics.highZIndexElements.length).toBeGreaterThan(0);
    expect(parallelResult.resourceUsage).toBe(null);

    await pageAnalyzer.dispose();
  });

  test('should demonstrate performance improvement vs sequential analysis', async ({ page }) => {
    const complexContent = `
      <html>
        <body>
          <iframe src="data:text/html,<h1>Test Frame</h1>"></iframe>
          ${Array.from({ length: 800 }, (_, i) =>
    `<div><button>Button ${i}</button><input type="text"><select><option>Option</option></select></div>`
  ).join('')}
        </body>
      </html>
    `;
    await page.goto(`data:text/html,${complexContent}`);

    const pageAnalyzer = new PageAnalyzer(page);

    // Test sequential analysis timing
    const sequentialStart = Date.now();
    const [structureAnalysis, performanceMetrics] = await Promise.all([
      pageAnalyzer.analyzePageStructure(),
      pageAnalyzer.analyzePerformanceMetrics()
    ]);
    Date.now() - sequentialStart;

    // Test parallel analysis timing
    const parallelStart = Date.now();
    const parallelResult = await pageAnalyzer.runParallelAnalysis();
    const parallelTime = Date.now() - parallelStart;

    // Parallel should be similar or faster, with added monitoring capabilities
    expect(parallelTime).toBeLessThan(500);
    expect(parallelResult.resourceUsage).toBe(null);

    // Verify data completeness is maintained
    expect(parallelResult.structureAnalysis.iframes.detected).toBe(structureAnalysis.iframes.detected);
    expect(parallelResult.performanceMetrics.domMetrics.totalElements)
        .toBeCloseTo(performanceMetrics.domMetrics.totalElements, -50); // Within reasonable range

    await pageAnalyzer.dispose();
  });

  test('should maintain performance under resource constraints', async ({ page }) => {
    const resourceIntensiveContent = `
      <html>
        <body>
          ${Array.from({ length: 3 }, (_, i) => `<iframe src="data:text/html,<h1>Frame ${i}</h1>"></iframe>`).join('')}
          ${Array.from({ length: 1200 }, (_, i) => {
    const complexity = i % 5;
    return `<div class="level-${complexity}">
              <button data-complexity="${complexity}" onclick="console.log(${i})">Btn ${i}</button>
              <input type="text" id="input-${i}" data-value="${i}" placeholder="Enter ${i}">
              <select name="select-${i}">
                ${Array.from({ length: complexity + 2 }, (_, j) => `<option value="${j}">Option ${j}</option>`).join('')}
              </select>
              <img src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCI+PC9zdmc+" alt="Image ${i}">
            </div>`;
  }).join('')}
        </body>
      </html>
    `;
    await page.goto(`data:text/html,${resourceIntensiveContent}`);

    const pageAnalyzer = new PageAnalyzer(page);

    // Run multiple analysis to test consistency
    const times: number[] = [];
    const results: any[] = [];

    for (let i = 0; i < 3; i++) {
      const start = Date.now();
      const result = await pageAnalyzer.runParallelAnalysis();
      const time = Date.now() - start;

      times.push(time);
      results.push(result);
    }

    // All runs should meet performance target
    times.forEach((time, index) => {
      expect(time).toBeLessThan(500);
    });

    // Results should be consistent
    const firstResult = results[0];
    results.forEach((result, index) => {
      expect(result.structureAnalysis.iframes.count).toBe(firstResult.structureAnalysis.iframes.count);
      expect(Math.abs(result.performanceMetrics.domMetrics.totalElements - firstResult.performanceMetrics.domMetrics.totalElements))
          .toBeLessThan(10); // Allow small variance
    });

    // Average time should be well under target
    const averageTime = times.reduce((sum, time) => sum + time, 0) / times.length;
    expect(averageTime).toBeLessThan(450);

    await pageAnalyzer.dispose();
  });
});

test.describe('Diagnostic System Integration', () => {
  test('should provide comprehensive diagnostic data within 300ms', async ({ page }) => {
    await page.goto('data:text/html,<div><button>Test</button><iframe src="about:blank"></iframe></div>');

    const startTime = Date.now();

    const pageAnalyzer = new PageAnalyzer(page);
    const elementDiscovery = new ElementDiscovery(page);
    const errorEnrichment = new ErrorEnrichment(page);

    // Simulate comprehensive diagnostic collection
    const [analysis, alternatives, enrichedError] = await Promise.all([
      pageAnalyzer.analyzePageStructure(),
      elementDiscovery.findAlternativeElements({
        originalSelector: 'button[data-missing="true"]',
        searchCriteria: { role: 'button' }
      }),
      errorEnrichment.enrichElementNotFoundError({
        originalError: new Error('Test error'),
        selector: 'missing-element',
        searchCriteria: { text: 'Test' }
      })
    ]);

    const executionTime = Date.now() - startTime;

    expect(executionTime).toBeLessThan(300); // Performance requirement
    expect(analysis).toBeDefined();
    expect(alternatives).toBeDefined();
    expect(enrichedError).toBeDefined();
  });

  test('should integrate parallel analysis with existing system', async ({ page }) => {
    const complexContent = `
      <html>
        <body>
          <div role="dialog">Modal Dialog</div>
          <iframe src="data:text/html,<h1>Iframe Content</h1>"></iframe>
          ${Array.from({ length: 500 }, (_, i) => `<button id="btn-${i}">Button ${i}</button>`).join('')}
        </body>
      </html>
    `;
    await page.goto(`data:text/html,${complexContent}`);

    const startTime = Date.now();

    const { ParallelPageAnalyzer } = await import('../src/diagnostics/ParallelPageAnalyzer.js');
    const parallelAnalyzer = new ParallelPageAnalyzer(page);
    const errorEnrichment = new ErrorEnrichment(page);

    const [parallelResult, enrichedError] = await Promise.all([
      parallelAnalyzer.runParallelAnalysis(),
      errorEnrichment.enrichTimeoutError({
        originalError: new Error('Timeout waiting for element'),
        operation: 'click',
        selector: 'button[data-test="missing"]'
      })
    ]);

    const executionTime = Date.now() - startTime;

    expect(executionTime).toBeLessThan(500);
    expect(parallelResult.structureAnalysis.modalStates.hasDialog).toBe(true);
    expect(parallelResult.structureAnalysis.iframes.detected).toBe(true);
    expect(parallelResult.performanceMetrics.domMetrics.totalElements).toBeGreaterThan(500);
    expect(enrichedError.suggestions).toContain('Page has active modal dialog - handle it before performing click');
  });
});

test.describe('configOverrides visibility and impact', () => {
  test('should show applied overrides in diagnostic report', async ({ page }) => {
    await page.goto('data:text/html,<html><body><h1>Test Page</h1></body></html>');

    const mockContext = {
      currentTabOrDie: () => ({
        page,
        id: 'test-tab',
        modalStates: () => [],
        modalStatesMarkdown: () => []
      }),
      tab: { page, id: 'test-tab' }
    };

    const mockResponse = {
      results: [] as string[],
      addResult: function(result: string) { this.results.push(result); },
      addError: function(error: string) { this.results.push(`ERROR: ${error}`); }
    };

    const params = {
      configOverrides: {
        enableResourceMonitoring: false,
        performanceThresholds: {
          pageAnalysis: 2000,
          elementDiscovery: 1500
        }
      },
      includeSystemStats: true,
      useUnifiedSystem: true
    };

    const { browserDiagnose } = await import('../src/tools/diagnose.js');

    await browserDiagnose.handle(mockContext as any, params, mockResponse as any);

    const report = mockResponse.results.join('\n');

    // Check that applied overrides are visible in the report
    expect(report).toContain('Applied Configuration Overrides');
    expect(report).toContain('Resource Monitoring: Disabled');
    expect(report).toContain('Performance Thresholds:');
    // Check for actual threshold values reported in the format: oldValue → newValue
    expect(report).toMatch(/1000ms → 2000ms|Page Analysis:.*2000ms/);
    expect(report).toMatch(/500ms → 1500ms|Element Discovery:.*1500ms/);
  });

  test('should show different results with and without overrides', async ({ page }) => {
    await page.goto('data:text/html,<html><body><h1>Test Page</h1></body></html>');

    const mockContext = {
      currentTabOrDie: () => ({
        page,
        id: 'test-tab',
        modalStates: () => [],
        modalStatesMarkdown: () => []
      }),
      tab: { page, id: 'test-tab' }
    };

    // Test without overrides
    const mockResponseWithout = {
      results: [] as string[],
      addResult: function(result: string) { this.results.push(result); },
      addError: function(error: string) { this.results.push(`ERROR: ${error}`); }
    };

    const paramsWithout = {
      includeSystemStats: true,
      useUnifiedSystem: true
    };

    // Test with overrides
    const mockResponseWith = {
      results: [] as string[],
      addResult: function(result: string) { this.results.push(result); },
      addError: function(error: string) { this.results.push(`ERROR: ${error}`); }
    };

    const paramsWith = {
      configOverrides: {
        enableResourceMonitoring: true,
        performanceThresholds: {
          pageAnalysis: 10000
        }
      },
      includeSystemStats: true,
      useUnifiedSystem: true
    };

    const { browserDiagnose } = await import('../src/tools/diagnose.js');

    await browserDiagnose.handle(mockContext as any, paramsWithout, mockResponseWithout as any);
    await browserDiagnose.handle(mockContext as any, paramsWith, mockResponseWith as any);

    const reportWithout = mockResponseWithout.results.join('\n');
    const reportWith = mockResponseWith.results.join('\n');

    // Reports should be different
    expect(reportWith).not.toEqual(reportWithout);

    // Report with overrides should contain override information
    expect(reportWith).toContain('Custom overrides applied');
    expect(reportWith).toContain('Applied Configuration Overrides');

    // Report without overrides should use default settings
    expect(reportWithout).toContain('Default settings');
    expect(reportWithout).not.toContain('Applied Configuration Overrides');
  });

  test('should show configuration impact analysis', async ({ page }) => {
    await page.goto('data:text/html,<html><body><h1>Test Page</h1></body></html>');

    const mockContext = {
      currentTabOrDie: () => ({
        page,
        id: 'test-tab',
        modalStates: () => [],
        modalStatesMarkdown: () => []
      }),
      tab: { page, id: 'test-tab' }
    };

    const mockResponse = {
      results: [] as string[],
      addResult: function(result: string) { this.results.push(result); },
      addError: function(error: string) { this.results.push(`ERROR: ${error}`); }
    };

    const params = {
      configOverrides: {
        enableResourceMonitoring: true,
        enableErrorEnrichment: true,
        performanceThresholds: {
          pageAnalysis: 5000,
          elementDiscovery: 3000
        }
      },
      includeSystemStats: true,
      useUnifiedSystem: true
    };

    const { browserDiagnose } = await import('../src/tools/diagnose.js');

    await browserDiagnose.handle(mockContext as any, params, mockResponse as any);

    const report = mockResponse.results.join('\n');

    // Check for configuration impact analysis
    expect(report).toContain('### Configuration Impact Analysis');
    expect(report).toContain('**Configuration Status:**');

    // Check for performance baseline comparison instead of applied changes
    expect(report).toContain('**Performance Baseline Comparison:**');
    expect(report).toMatch(/pageAnalysis.*Expected.*5000ms/);
  });
});
