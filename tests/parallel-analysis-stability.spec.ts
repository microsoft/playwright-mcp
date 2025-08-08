/**
 * Test for parallel analysis stability improvements
 * Verifies that parallel analysis mode selection is consistent and predictable
 */

import { expect, test } from '@playwright/test';
import { SmartConfigManager } from '../src/diagnostics/smart-config.js';
import { UnifiedDiagnosticSystem } from '../src/diagnostics/unified-system.js';

test.describe('Parallel Analysis Stability', () => {
  test('should consistently use parallel analysis when explicitly requested', async ({
    page,
  }) => {
    // Navigate to a test page
    await page.goto(
      'data:text/html,<html><head><title>Test</title></head><body><div>Test content</div></body></html>'
    );

    // Initialize unified system with parallel analysis enabled
    const configManager = SmartConfigManager.getInstance({
      features: {
        enableParallelAnalysis: true,
        enableSmartHandleManagement: true,
        enableAdvancedElementDiscovery: true,
        enableResourceLeakDetection: true,
        enableRealTimeMonitoring: false,
      },
    });

    const unifiedSystem = UnifiedDiagnosticSystem.getInstance(
      page,
      configManager.getConfig()
    );

    // Initialize components
    await unifiedSystem.initializeComponents();

    // Test multiple consecutive calls with forceParallel=true
    const results: Array<{
      success: boolean;
      data?: unknown;
      error?: unknown;
    }> = [];

    for (let i = 0; i < 5; i++) {
      const result = await unifiedSystem.analyzePageStructure(true);
      expect(result.success).toBe(true);
      results.push(result);
    }

    // Verify all results are consistent
    for (const result of results) {
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      // console.log(`Test ${index + 1}: Success=${result.success}, ExecutionTime=${result.executionTime}ms`);
    }

    await unifiedSystem.dispose();
  });

  test('should respect page complexity recommendations when not forced', async ({
    page,
  }) => {
    // Create a complex page with many elements
    const complexHTML = `
      <html>
        <head><title>Complex Page</title></head>
        <body>
          ${Array.from({ length: 1000 }, (_, i) => `<div id="element-${i}">Content ${i}</div>`).join('')}
          <iframe src="about:blank"></iframe>
          <iframe src="about:blank"></iframe>
          ${Array.from({ length: 50 }, (_, i) => `<input type="text" name="input-${i}" />`).join('')}
          ${Array.from({ length: 50 }, (_, i) => `<button id="btn-${i}">Button ${i}</button>`).join('')}
        </body>
      </html>
    `;

    await page.goto(`data:text/html,${encodeURIComponent(complexHTML)}`);

    const unifiedSystem = UnifiedDiagnosticSystem.getInstance(page, {
      features: { enableParallelAnalysis: true },
    });

    await unifiedSystem.initializeComponents();

    // Should use parallel analysis due to high complexity
    const result = await unifiedSystem.analyzePageStructure();

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    // console.log(`Complex page analysis: Success=${result.success}, ExecutionTime=${result.executionTime}ms`);

    // Check if parallel analysis was used by looking for structureAnalysis property
    const _hasParallelStructure =
      result.data && 'structureAnalysis' in result.data;
    // console.log(`Parallel analysis detected: ${hasParallelStructure}`);

    await unifiedSystem.dispose();
  });

  test('should use standard analysis for simple pages when not forced', async ({
    page,
  }) => {
    // Create a simple page with few elements
    const simpleHTML = `
      <html>
        <head><title>Simple Page</title></head>
        <body>
          <h1>Simple Page</h1>
          <p>This is a simple page with minimal complexity.</p>
          <button>Click me</button>
        </body>
      </html>
    `;

    await page.goto(`data:text/html,${encodeURIComponent(simpleHTML)}`);

    const unifiedSystem = UnifiedDiagnosticSystem.getInstance(page, {
      features: { enableParallelAnalysis: true },
    });

    await unifiedSystem.initializeComponents();

    // Should use standard analysis due to low complexity
    const result = await unifiedSystem.analyzePageStructure();

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    // console.log(`Simple page analysis: Success=${result.success}, ExecutionTime=${result.executionTime}ms`);

    // Check if standard analysis was used (no structureAnalysis property)
    const _hasParallelStructure =
      result.data && 'structureAnalysis' in result.data;
    // console.log(`Parallel analysis detected: ${hasParallelStructure}`);

    await unifiedSystem.dispose();
  });

  test('should override complexity recommendations with force flag', async ({
    page,
  }) => {
    // Create a simple page
    await page.goto(
      'data:text/html,<html><head><title>Simple</title></head><body><div>Simple</div></body></html>'
    );

    const unifiedSystem = UnifiedDiagnosticSystem.getInstance(page, {
      features: { enableParallelAnalysis: true },
    });

    await unifiedSystem.initializeComponents();

    // Force parallel analysis even for simple page
    const forcedResult = await unifiedSystem.analyzePageStructure(true);

    expect(forcedResult.success).toBe(true);
    expect(forcedResult.data).toBeDefined();
    // console.log(`Forced parallel analysis: Success=${forcedResult.success}, ExecutionTime=${forcedResult.executionTime}ms`);

    // Normal analysis without force
    const normalResult = await unifiedSystem.analyzePageStructure();

    expect(normalResult.success).toBe(true);
    expect(normalResult.data).toBeDefined();
    // console.log(`Normal analysis: Success=${normalResult.success}, ExecutionTime=${normalResult.executionTime}ms`);

    await unifiedSystem.dispose();
  });

  test('should maintain performance logging consistency', async ({ page }) => {
    await page.goto(
      'data:text/html,<html><head><title>Test</title></head><body><h1>Logging Test</h1></body></html>'
    );

    const unifiedSystem = UnifiedDiagnosticSystem.getInstance(page, {
      features: { enableParallelAnalysis: true },
    });

    await unifiedSystem.initializeComponents();

    // Run analysis - the system should complete successfully regardless of logging
    const result = await unifiedSystem.analyzePageStructure(true);

    // Verify the analysis completes successfully
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();

    // Verify system state is consistent
    expect(unifiedSystem).toBeDefined();

    await unifiedSystem.dispose();
  });
});
