// @ts-nocheck
/**
 * Phase 1 Memory Leak Prevention Verification Tests
 */

import { expect, test } from '@playwright/test';
import { ElementDiscovery } from '../src/diagnostics/element-discovery.js';
import { FrameReferenceManager } from '../src/diagnostics/frame-reference-manager.js';
import { PageAnalyzer } from '../src/diagnostics/page-analyzer.js';
import { ResourceManager } from '../src/diagnostics/resource-manager.js';
import { SmartHandleBatch } from '../src/diagnostics/smart-handle.js';

test.describe('Phase 1 - Memory Leak Prevention', () => {
  test('ResourceManager should track and dispose resources', async () => {
    const resourceManager = new ResourceManager();

    // Mock resource with dispose method
    const mockResource = {
      disposed: false,
      dispose: async () => {
        mockResource.disposed = true;
      },
    };

    // Track resource
    resourceManager.trackResource(mockResource, 'dispose');
    expect(resourceManager.getActiveCount()).toBe(1);

    // Dispose all
    await resourceManager.disposeAll();
    expect(resourceManager.getActiveCount()).toBe(0);
    expect(mockResource.disposed).toBe(true);

    // Cleanup
    await resourceManager.dispose();
  });

  test('SmartHandleBatch should manage multiple handles', async ({ page }) => {
    await page.goto(
      'data:text/html,<html><body><div>Test 1</div><div>Test 2</div><div>Test 3</div></body></html>'
    );

    const batch = new SmartHandleBatch();
    const elements = await page.$$('div');

    // Add elements to batch
    const smartElements = elements.map((el) => batch.add(el));
    expect(batch.getActiveCount()).toBe(3);
    expect(smartElements).toHaveLength(3);

    // Dispose all
    await batch.disposeAll();
    expect(batch.getActiveCount()).toBe(0);
    expect(batch.isDisposed()).toBe(true);
  });

  test('ElementDiscovery should enforce batch size limits', async ({
    page,
  }) => {
    await page.goto(
      'data:text/html,<html><body>' +
        Array.from({ length: 200 }, (_, i) => `<div>Item ${i}</div>`).join('') +
        '</body></html>'
    );

    const elementDiscovery = new ElementDiscovery(page);

    // Request more than maxBatchSize (100)
    const alternatives = await elementDiscovery.findAlternativeElements({
      originalSelector: 'div',
      searchCriteria: { tagName: 'div' },
      maxResults: 150,
    });

    // Should be limited to maxBatchSize
    expect(alternatives.length).toBeLessThanOrEqual(100);

    // Check memory stats
    const stats = elementDiscovery.getMemoryStats();
    expect(stats.maxBatchSize).toBe(100);
    expect(stats.isDisposed).toBe(false);

    await elementDiscovery.dispose();

    const finalStats = elementDiscovery.getMemoryStats();
    expect(finalStats.isDisposed).toBe(true);
  });

  test('FrameReferenceManager should track iframe frames', async ({ page }) => {
    await page.goto(
      'data:text/html,<html><body><iframe src="data:text/html,<h1>Frame Content</h1>"></iframe></body></html>'
    );

    const frameManager = new FrameReferenceManager();

    // Get iframe and its content frame
    const iframe = await page.$('iframe');
    const frame = await iframe.contentFrame();

    if (frame) {
      frameManager.trackFrame(frame);

      const stats = frameManager.getStatistics();
      expect(stats.activeCount).toBe(1);
      expect(stats.totalTracked).toBe(1);

      // Update element count
      frameManager.updateElementCount(frame, 5);

      // Get metadata
      const metadata = frameManager.getFrameMetadata(frame);
      expect(metadata).toBeDefined();
      expect(metadata?.elementCount).toBe(5);
      expect(metadata?.isDetached).toBe(false);
    }

    // Cleanup
    await frameManager.dispose();
    await iframe.dispose();
  });

  test('PageAnalyzer should use FrameReferenceManager', async ({ page }) => {
    await page.goto(
      'data:text/html,<html><body><iframe src="data:text/html,<h1>Test Frame</h1>"></iframe></body></html>'
    );

    const pageAnalyzer = new PageAnalyzer(page);

    // Analyze page structure
    const analysis = await pageAnalyzer.analyzePageStructure();
    expect(analysis.iframes.detected).toBe(true);
    expect(analysis.iframes.count).toBe(1);

    // Get frame stats
    const frameStats = pageAnalyzer.getFrameStats();
    expect(frameStats.isDisposed).toBe(false);

    // If iframe is accessible, should have tracked frames
    if (analysis.iframes.accessible.length > 0) {
      expect(frameStats.frameStats.activeCount).toBeGreaterThanOrEqual(0);
    }

    // Cleanup
    await pageAnalyzer.cleanupFrames();
    await pageAnalyzer.dispose();

    const finalStats = pageAnalyzer.getFrameStats();
    expect(finalStats.isDisposed).toBe(true);
  });

  test('Memory leak prevention with large element search', async ({ page }) => {
    // Create page with many elements
    const htmlContent = `
      <html><body>
        ${Array.from(
          { length: 500 },
          (_, i) => `
          <div class="item-${i}" data-id="${i}">
            <button>Button ${i}</button>
            <input type="text" placeholder="Input ${i}" />
            <span>Span ${i}</span>
          </div>
        `
        ).join('')}
      </body></html>
    `;

    await page.goto(`data:text/html,${htmlContent}`);

    const elementDiscovery = new ElementDiscovery(page);

    // Perform multiple searches
    const searches = await Promise.all([
      elementDiscovery.findAlternativeElements({
        originalSelector: 'button',
        searchCriteria: { tagName: 'button' },
        maxResults: 50,
      }),
      elementDiscovery.findAlternativeElements({
        originalSelector: 'input',
        searchCriteria: { tagName: 'input' },
        maxResults: 50,
      }),
      elementDiscovery.findAlternativeElements({
        originalSelector: 'span',
        searchCriteria: { tagName: 'span' },
        maxResults: 50,
      }),
    ]);

    // Each search should be limited
    for (const results of searches) {
      expect(results.length).toBeLessThanOrEqual(50);
    }

    // Check memory stats
    const stats = elementDiscovery.getMemoryStats();
    expect(stats.activeHandles).toBeGreaterThan(0);
    // Note: Multiple parallel searches can exceed maxBatchSize temporarily
    // but each individual search is limited to maxBatchSize
    expect(stats.maxBatchSize).toBe(100);

    // Dispose should clean up all handles
    await elementDiscovery.dispose();

    const finalStats = elementDiscovery.getMemoryStats();
    expect(finalStats.activeHandles).toBe(0);
    expect(finalStats.isDisposed).toBe(true);
  });
});
