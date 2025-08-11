/**
 * Enhanced Error Handler Tests - Integration of diagnostic systems with error handling
 */

import { expect, test } from '@playwright/test';
import { EnhancedErrorHandler } from '../src/diagnostics/enhanced-error-handler.js';

test.describe('EnhancedErrorHandler', () => {
  test('should enhance Playwright errors with diagnostic information', async ({
    page,
  }) => {
    await page.goto('data:text/html,<div><button>Click Me</button></div>');

    const errorHandler = new EnhancedErrorHandler(page);
    const originalError = new Error(
      'Element not found: button[data-test="missing"]'
    );

    const enhancedError = await errorHandler.enhancePlaywrightError({
      error: originalError,
      operation: 'click',
      selector: 'button[data-test="missing"]',
      context: {
        searchCriteria: {
          text: 'Click',
          role: 'button',
        },
      },
    });

    expect(enhancedError.message).toContain('Element not found');
    expect(enhancedError.alternatives).toBeDefined();
    expect(enhancedError.alternatives?.length).toBeGreaterThan(0);
    expect(enhancedError.diagnosticInfo).toBeDefined();
    expect(enhancedError.suggestions).toContain(
      'Try using one of the 1 alternative elements found'
    );
  });

  test('should provide timeout-specific enhancements', async ({ page }) => {
    await page.goto(
      'data:text/html,<div><iframe src="data:text/html,<button>In Frame</button>"></iframe></div>'
    );

    const errorHandler = new EnhancedErrorHandler(page);
    const timeoutError = new Error('Timeout 30000ms exceeded');

    const enhancedError = await errorHandler.enhanceTimeoutError({
      error: timeoutError,
      operation: 'click',
      selector: 'button',
      timeout: 30_000,
    });

    expect(enhancedError.diagnosticInfo?.iframes.detected).toBe(true);
    expect(enhancedError.suggestions).toContain(
      'Element might be inside an iframe'
    );
  });

  test('should detect when elements are in different context', async ({
    page,
  }) => {
    await page.goto(
      'data:text/html,<div><iframe id="frame" src="data:text/html,<button id=inner>Inside</button>"></iframe><button id="outer">Outside</button></div>'
    );

    const errorHandler = new EnhancedErrorHandler(page);
    const error = new Error('Element not found in main frame');

    const enhancedError = await errorHandler.enhanceContextError({
      error,
      selector: 'button#inner',
      expectedContext: 'main',
    });

    expect(enhancedError.contextInfo?.availableFrames).toBeGreaterThan(0);
    expect(enhancedError.suggestions).toContain(
      'element might be in a different frame - use frameLocator()'
    );
  });

  test('should provide performance insights for slow operations', async ({
    page,
  }) => {
    await page.goto(
      'data:text/html,<div><button onclick="setTimeout(() => alert(\'slow\'), 2000)">Slow Action</button></div>'
    );

    const errorHandler = new EnhancedErrorHandler(page);

    const start = Date.now();
    // Simulate a slow operation
    await new Promise((resolve) => setTimeout(resolve, 100));
    const executionTime = Date.now() - start;

    const enhancedError = await errorHandler.enhancePerformanceError({
      operation: 'click',
      selector: 'button',
      executionTime,
      performanceThreshold: 50,
    });

    expect(enhancedError.performanceInfo?.executionTime).toBe(executionTime);
    expect(enhancedError.performanceInfo?.exceededThreshold).toBe(true);
    expect(
      enhancedError.suggestions.some((s) =>
        s.includes('Operation took longer than expected')
      )
    ).toBe(true);
  });

  test('should integrate with existing tool error handling', async ({
    page,
  }) => {
    await page.goto(
      'data:text/html,<div><button disabled>Disabled</button></div>'
    );

    const errorHandler = new EnhancedErrorHandler(page);

    const enhancedError = await errorHandler.enhanceToolError({
      toolName: 'browser_click',
      error: new Error('Element is not enabled'),
      selector: 'button',
      toolArgs: {
        element: 'button',
        ref: 'button',
      },
    });

    expect(enhancedError.toolContext?.toolName).toBe('browser_click');
    expect(enhancedError.suggestions).toContain(
      'Element appears to be disabled'
    );
  });
});

test.describe('EnhancedErrorHandler Performance', () => {
  test('should complete error enhancement within 300ms', async ({ page }) => {
    await page.goto(
      'data:text/html,<div><button>Test</button><iframe src="about:blank"></iframe></div>'
    );

    const errorHandler = new EnhancedErrorHandler(page);
    const start = Date.now();

    await errorHandler.enhancePlaywrightError({
      error: new Error('Test error'),
      operation: 'click',
      selector: 'button[data-missing="true"]',
      context: {
        searchCriteria: { text: 'Test', role: 'button' },
      },
    });

    const executionTime = Date.now() - start;
    expect(executionTime).toBeLessThan(300);
  });
});
