import { Response } from '../src/response.js';
import { Tab } from '../src/tab.js';
import { waitForCompletion } from '../src/tools/utils.js';
import { expect, test } from './fixtures.js';

test.describe('Navigation Context Handling', () => {
  test.describe('waitForCompletion enhancement', () => {
    test('should handle navigation completion with stable context', async ({
      page,
    }) => {
      // Create a mock context for testing
      const mockContext = {
        currentTab: () => tab,
        currentTabOrDie: () => tab,
        tabs: () => [tab],
        config: { imageResponses: 'include' },
      } as any;

      const tab = new Tab(mockContext, page, () => {
        // No-op callback for test
      });

      // Navigate to a page that will trigger context changes
      await page.goto(
        'data:text/html,<html><body><h1>Initial Page</h1></body></html>'
      );

      const result = await waitForCompletion(tab, async () => {
        // Trigger navigation within the callback using proper Playwright navigation
        await page.goto(
          'data:text/html,<html><body><h1>New Page</h1></body></html>'
        );
        return 'navigation-triggered';
      });

      expect(result).toBe('navigation-triggered');
      await expect(page.locator('h1')).toHaveText('New Page');
    });

    test('should wait for network requests after navigation', async ({
      page,
    }) => {
      const mockContext = {
        currentTab: () => tab,
        currentTabOrDie: () => tab,
        tabs: () => [tab],
        config: { imageResponses: 'include' },
      } as any;

      const tab = new Tab(mockContext, page, () => {
        // No-op callback for test
      });

      await page.goto('data:text/html,<html><body><h1>Test</h1></body></html>');

      const result = await waitForCompletion(tab, async () => {
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
      });

      expect(result).toBe('request-with-navigation');
    });

    test('should handle timeout gracefully during navigation', async ({
      page,
    }) => {
      const mockContext = {
        currentTab: () => tab,
        currentTabOrDie: () => tab,
        tabs: () => [tab],
        config: { imageResponses: 'include' },
      } as any;

      const tab = new Tab(mockContext, page, () => {
        // No-op callback for test
      });

      await page.goto('data:text/html,<html><body><h1>Test</h1></body></html>');

      // This should complete within the timeout period
      const result = await waitForCompletion(tab, async () => {
        // Trigger a quick navigation
        await page.goto(
          'data:text/html,<html><body><h1>Quick Nav</h1></body></html>'
        );
        return 'timeout-test';
      });

      expect(result).toBe('timeout-test');
    });
  });

  test.describe('Response.finish() navigation detection', () => {
    test('should detect navigation and defer snapshot capture', async ({
      page,
    }) => {
      const mockContext = {
        currentTab: () => tab,
        currentTabOrDie: () => tab,
        tabs: () => [tab],
        config: { imageResponses: 'include' },
      } as any;

      const tab = new Tab(mockContext, page, () => {
        // No-op callback for test
      });

      await page.goto(
        'data:text/html,<html><body><h1>Initial</h1></body></html>'
      );

      const response = new Response(
        mockContext,
        'test_tool',
        {},
        { includeSnapshot: true }
      );
      response.addResult('Navigation test result');

      // Simulate navigation before finish()
      const navigationPromise = page.goto(
        'data:text/html,<html><body><h1>After Navigation</h1></body></html>'
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
      const mockContext = {
        currentTab: () => tab,
        currentTabOrDie: () => tab,
        tabs: () => [tab],
        config: { imageResponses: 'include' },
      } as any;

      const tab = new Tab(mockContext, page, () => {
        // No-op callback for test
      });

      await page.goto('data:text/html,<html><body><h1>Test</h1></body></html>');

      const response = new Response(
        mockContext,
        'test_tool',
        {},
        { includeSnapshot: true }
      );
      response.addResult('Context destruction test');

      // Simulate rapid navigation that could destroy context
      await page.goto(
        'data:text/html,<html><body><h1>New Context</h1></body></html>'
      );

      // Should not throw "Execution context was destroyed" error
      await expect(response.finish()).resolves.not.toThrow();

      const snapshot = response.tabSnapshot();
      expect(snapshot).toBeDefined();
    });

    test('should retry snapshot capture on context destruction', async ({
      page,
    }) => {
      const mockContext = {
        currentTab: () => tab,
        currentTabOrDie: () => tab,
        tabs: () => [tab],
        config: { imageResponses: 'include' },
      } as any;

      const tab = new Tab(mockContext, page, () => {
        // No-op callback for test
      });

      await page.goto(
        'data:text/html,<html><body><h1>Original</h1></body></html>'
      );

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
      await page.goto(
        'data:text/html,<html><body><h1>Navigated</h1></body></html>'
      );

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
      const mockContext = {
        currentTab: () => tab,
        currentTabOrDie: () => tab,
        tabs: () => [tab],
        config: { imageResponses: 'include' },
      } as any;

      const tab = new Tab(mockContext, page, () => {
        // No-op callback for test
      });

      // Create a page that responds to Enter key with navigation
      await page.goto(`data:text/html,
        <html>
          <body>
            <input id="search" type="text" value="test">
            <h1>Before Navigation</h1>
          </body>
        </html>
      `);

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
        await page.goto(
          'data:text/html,<html><body><h1>Search Results</h1><p>Results for: test</p></body></html>'
        );
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
      const mockContext = {
        currentTab: () => tab,
        currentTabOrDie: () => tab,
        tabs: () => [tab],
        config: { imageResponses: 'include' },
      } as any;

      const tab = new Tab(mockContext, page, () => {
        // No-op callback for test
      });

      await page.goto(
        'data:text/html,<html><body><h1>Initial</h1></body></html>'
      );

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
        // console.log('Before navigation');
      });
      await page.goto(
        'data:text/html,<html><body><h1>After Nav</h1><script>console.log("After navigation");</script></body></html>'
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
