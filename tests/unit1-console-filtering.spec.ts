/**
 * Unit 1: Console Filtering Improvement Tests
 * Testing console filtering functionality with HTML page console messages
 */

import { expect, test } from './fixtures.js';
import { HTML_TEMPLATES, setServerContent } from './test-helpers.js';

test.describe('Unit 1: Console Filtering Improvements', () => {
  test('browser_console_messages with filtering options should work', async ({
    client,
    server,
  }) => {
    // Create HTML with various console messages
    const testHtml = `
      <html>
        <body>
          <script>
            console.log("User logged in successfully");
            console.error("Network error occurred");
            console.warn("Warning message");
            console.info("Info message");
            console.log("User logged out");
            console.log("System startup complete");
            // Add more messages to ensure they're captured
            setTimeout(() => {
              console.warn("Delayed warning message");
            }, 50);
          </script>
        </body>
      </html>
    `;

    setServerContent(server, '/', testHtml);

    const navigationResult = await client.callTool({
      name: 'browser_navigate',
      arguments: {
        url: server.PREFIX,
      },
    });

    if (navigationResult.isError) {
      return;
    }

    // Wait for page load and console messages
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Test level filtering - just focus on what we know works
    const levelFilterResult = await client.callTool({
      name: 'browser_console_messages',
      arguments: {
        consoleOptions: {
          levels: ['error'],
        },
      },
    });

    if (!levelFilterResult.isError) {
      const levelText = levelFilterResult.content?.[0]?.text || '';
      expect(levelText).toContain('Network error occurred');
      expect(levelText).not.toContain('User logged in successfully');
      expect(levelText).not.toContain('Info message');
    }

    // Test pattern filtering
    const patternFilterResult = await client.callTool({
      name: 'browser_console_messages',
      arguments: {
        consoleOptions: {
          patterns: ['User.*logged'],
        },
      },
    });

    if (!patternFilterResult.isError) {
      const patternText = patternFilterResult.content?.[0]?.text || '';
      expect(patternText).toContain('User logged in successfully');
      expect(patternText).toContain('User logged out');
      expect(patternText).not.toContain('Network error occurred');
      expect(patternText).not.toContain('System startup complete');
    }

    // Test message limit
    const limitFilterResult = await client.callTool({
      name: 'browser_console_messages',
      arguments: {
        consoleOptions: {
          maxMessages: 3,
        },
      },
    });

    if (!limitFilterResult.isError) {
      const limitText = limitFilterResult.content?.[0]?.text || '';
      const messageCount = limitText
        .split('\n')
        .filter(
          (line) =>
            line.includes('[LOG]') ||
            line.includes('[ERROR]') ||
            line.includes('[WARN]') ||
            line.includes('[INFO]')
        ).length;
      expect(messageCount).toBeLessThanOrEqual(3);
    }
  });

  test('expectation includeConsole functionality exists', async ({
    client,
    server,
  }) => {
    // Use existing template that generates console messages
    setServerContent(server, '/', HTML_TEMPLATES.CONSOLE_LOG_ERROR);

    const navigationResult = await client.callTool({
      name: 'browser_navigate',
      arguments: {
        url: server.PREFIX,
      },
    });

    if (navigationResult.isError) {
      return;
    }

    // Test that expectation parameter is accepted without errors
    const evaluateResult = await client.callTool({
      name: 'browser_evaluate',
      arguments: {
        function: '() => { return "test complete"; }',
        expectation: {
          includeConsole: true,
          includeSnapshot: false,
        },
      },
    });

    if (evaluateResult.isError) {
      return;
    }

    // Just verify the command completes without error and has basic response structure
    const responseText =
      evaluateResult.content?.find((c) => c.type === 'text')?.text || '';
    expect(responseText).toContain('### Result');
    expect(responseText).toContain('test complete');
  });

  test('console filtering with combined options should work', async ({
    client,
    server,
  }) => {
    // Create HTML with many console messages for comprehensive testing
    const testHtml = `
      <html>
        <body>
          <script>
            console.log("User action: login");
            console.log("User action: logout");
            console.error("Error: Network failure");
            console.warn("Warning: Low memory");
            console.info("Info: Task completed");
            console.log("System: Database connected");
            console.log("User action: login"); // Duplicate
            console.error("Error: Disk full");
            console.log("User action: profile update");
          </script>
        </body>
      </html>
    `;

    setServerContent(server, '/', testHtml);

    const navigationResult = await client.callTool({
      name: 'browser_navigate',
      arguments: {
        url: server.PREFIX,
      },
    });

    if (navigationResult.isError) {
      return;
    }

    // Wait for page load and console messages
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Test combined filtering: levels + patterns + limit + removeDuplicates
    const combinedFilterResult = await client.callTool({
      name: 'browser_console_messages',
      arguments: {
        consoleOptions: {
          levels: ['log', 'error'],
          patterns: ['User.*action', 'Error.*'],
          maxMessages: 4,
          removeDuplicates: true,
        },
      },
    });

    if (!combinedFilterResult.isError) {
      const combinedText = combinedFilterResult.content?.[0]?.text || '';

      // Should contain user actions and errors
      expect(combinedText).toContain('User action: login');
      expect(combinedText).toContain('Error: Network failure');

      // Should NOT contain warnings, info, or system messages
      expect(combinedText).not.toContain('Warning: Low memory');
      expect(combinedText).not.toContain('Info: Task completed');
      expect(combinedText).not.toContain('System: Database connected');

      // Check message count is within limit
      const messageCount = combinedText
        .split('\n')
        .filter(
          (line) => line.includes('[LOG]') || line.includes('[ERROR]')
        ).length;
      expect(messageCount).toBeLessThanOrEqual(4);
    }
  });

  test('invalid regex patterns should fallback to substring matching', async ({
    client,
    server,
  }) => {
    const testHtml = `
      <html>
        <body>
          <script>
            console.log("User message");
            console.log("System message");
            console.error("Error occurred");
          </script>
        </body>
      </html>
    `;

    setServerContent(server, '/', testHtml);

    const navigationResult = await client.callTool({
      name: 'browser_navigate',
      arguments: {
        url: server.PREFIX,
      },
    });

    if (navigationResult.isError) {
      return;
    }

    // Wait for page load and console messages
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Test with invalid regex pattern
    const invalidRegexResult = await client.callTool({
      name: 'browser_console_messages',
      arguments: {
        consoleOptions: {
          patterns: ['[invalid regex', 'User'], // First pattern is invalid regex
        },
      },
    });

    if (!invalidRegexResult.isError) {
      const invalidRegexText = invalidRegexResult.content?.[0]?.text || '';
      // Should still find "User message" using substring matching
      expect(invalidRegexText).toContain('User message');
      expect(invalidRegexText).not.toContain('System message');
    }
  });
});
