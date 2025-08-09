import { Response } from '../src/response.js';
import { waitForCompletion } from '../src/tools/utils.js';
import { expect, test } from './fixtures.js';
import { createTabWithMockContext, DATA_URLS } from './test-helpers.js';

test.describe('Navigation Context Handling', () => {
  const performRequestAndNavigation = async (page: any) => {
    // Trigger a request before navigation to simulate the scenario
    await page.evaluate(() => {
      fetch('/api/test').catch(() => {
        /* Ignore network errors in test */
      });
    });
    // Then navigate
    await page.goto(
      'data:text/html,<html><body><h1>After Request</h1></body></html>'
    );
    return 'request-with-navigation';
  };

  test.describe('waitForCompletion enhancement', () => {
    test('should handle navigation completion with stable context', async ({
      page,
    }) => {
      const { tab, mockContext } = createTabWithMockContext(page);

      // Navigate to a page that will trigger context changes
      await page.goto(DATA_URLS.SIMPLE_PAGE('Initial Page'));

      const result = await waitForCompletion(tab, async () => {
        // Trigger navigation within the callback using proper Playwright navigation
        await page.goto(DATA_URLS.SIMPLE_PAGE('New Page'));
        return 'navigation-triggered';
      });

      expect(result).toBe('navigation-triggered');
      await expect(page.locator('h1')).toHaveText('New Page');
    });

    test('should wait for network requests after navigation', async ({
      page,
    }) => {
      const { tab, mockContext } = createTabWithMockContext(page);

      await page.goto(DATA_URLS.SIMPLE_PAGE('Test'));

      const result = await waitForCompletion(tab, () =>
        performRequestAndNavigation(page)
      );

      expect(result).toBe('request-with-navigation');
    });

    test('should handle timeout gracefully during navigation', async ({
      page,
    }) => {
      const { tab, mockContext } = createTabWithMockContext(page);

      await page.goto(DATA_URLS.SIMPLE_PAGE('Test'));

      // This should complete within the timeout period
      const result = await waitForCompletion(tab, async () => {
        // Trigger a quick navigation
        await page.goto(DATA_URLS.SIMPLE_PAGE('Quick Nav'));
        return 'timeout-test';
      });

      expect(result).toBe('timeout-test');
    });
  });

  test.describe('Response.finish() navigation detection', () => {
    test('should detect navigation and defer snapshot capture', async ({
      page,
    }) => {
      const { tab, mockContext } = createTabWithMockContext(page);

      await page.goto(DATA_URLS.SIMPLE_PAGE('Initial'));

      const response = new Response(
        mockContext,
        'test_tool',
        {},
        { includeSnapshot: true }
      );
      response.addResult('Navigation test result');

      // Simulate navigation before finish()
      const navigationPromise = page.goto(
        DATA_URLS.SIMPLE_PAGE('After Navigation')
      );

      // Call finish() while navigation is in progress
      await Promise.all([navigationPromise, response.finish()]);

      const snapshot = response.tabSnapshot();
      expect(snapshot?.title).toBeDefined();
      expect(snapshot?.ariaSnapshot).toContain('After Navigation');
    });

    test('should handle execution context destruction gracefully', async ({
      page,
    }) => {
      const { tab, mockContext } = createTabWithMockContext(page);

      await page.goto(DATA_URLS.SIMPLE_PAGE('Test'));

      const response = new Response(
        mockContext,
        'test_tool',
        {},
        { includeSnapshot: true }
      );
      response.addResult('Context destruction test');

      // Simulate rapid navigation that could destroy context
      await page.goto(DATA_URLS.SIMPLE_PAGE('New Context'));

      // Should not throw "Execution context was destroyed" error
      await expect(response.finish()).resolves.not.toThrow();

      const snapshot = response.tabSnapshot();
      expect(snapshot).toBeDefined();
    });

    test('should retry snapshot capture on context destruction', async ({
      page,
    }) => {
      const { tab, mockContext } = createTabWithMockContext(page);

      await page.goto(DATA_URLS.SIMPLE_PAGE('Original'));

      const response = new Response(
        mockContext,
        'test_tool',
        {},
        { includeSnapshot: true }
      );
      response.addResult('Retry test result');

      // Trigger navigation right before finish()
      const finishPromise = response.finish();

      // Navigate immediately to potentially cause context destruction
      await page.goto(DATA_URLS.SIMPLE_PAGE('Navigated'));

      await finishPromise;

      const snapshot = response.tabSnapshot();
      expect(snapshot).toBeDefined();
      expect(snapshot?.ariaSnapshot).toBeTruthy();
    });
  });

  test.describe('Integration tests', () => {
    test('should handle press_key -> navigation -> snapshot sequence', async ({
      page,
    }) => {
      const { tab, mockContext } = createTabWithMockContext(page);

      // Create a page that responds to Enter key with navigation
      await page.goto(DATA_URLS.FORM_PAGE('search', 'test'));

      const response = new Response(
        mockContext,
        'browser_press_key',
        { key: 'Enter' },
        { includeSnapshot: true }
      );

      // Simulate the problematic sequence: press key -> navigation -> snapshot
      await waitForCompletion(tab, async () => {
        await page.locator('#search').press('Enter');
        // Simulate the navigation that would typically happen on Enter
        await page.goto(DATA_URLS.SEARCH_RESULTS_PAGE('test'));
        return 'key-pressed';
      });

      // This should not throw "Execution context was destroyed"
      await expect(response.finish()).resolves.not.toThrow();

      const snapshot = response.tabSnapshot();
      expect(snapshot).toBeDefined();
      expect(snapshot?.ariaSnapshot).toContain('Search Results');
    });

    test('should maintain response quality during navigation', async ({
      page,
    }) => {
      const { tab, mockContext } = createTabWithMockContext(page);

      await page.goto(DATA_URLS.SIMPLE_PAGE('Initial'));

      const response = new Response(
        mockContext,
        'test_navigation',
        {},
        {
          includeSnapshot: true,
          includeConsole: true,
          diffOptions: { enabled: true },
        }
      );

      response.addResult('Navigation response test');

      // Trigger navigation with console messages
      await page.evaluate(() => {
        // Empty evaluation for navigation context test
      });
      await page.goto(
        DATA_URLS.WITH_SCRIPT('After Nav', 'console.log("After navigation");')
      );

      await response.finish();

      const serialized = response.serialize();
      expect(serialized.content).toBeDefined();
      expect(serialized.content.length).toBeGreaterThan(0);

      const textContent = serialized.content.find(
        (c) => c.type === 'text'
      )?.text;
      expect(textContent).toContain('Navigation response test');
      expect(textContent).toContain('Page state');
    });
  });
});
