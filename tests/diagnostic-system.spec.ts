/**
 * Diagnostic System Tests - PageAnalyzer, ElementDiscovery, ErrorEnrichment
 */

import { test, expect } from '@playwright/test';
import { PageAnalyzer } from '../src/diagnostics/PageAnalyzer.js';
import { ElementDiscovery } from '../src/diagnostics/ElementDiscovery.js';
import { ErrorEnrichment } from '../src/diagnostics/ErrorEnrichment.js';
import { fixtures } from './fixtures.js';

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
    
    if (alternatives.length > 1) {
      expect(alternatives[0].confidence).toBeGreaterThanOrEqual(alternatives[1].confidence);
    }
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
});