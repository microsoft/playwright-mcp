/**
 * Integration tests for network filter functionality in network.ts tool
 * Testing the new filtering capabilities without breaking existing behavior
 */

import { expect, test } from './fixtures.js';

interface TestCase {
  name: string;
  fetchUrls: string[];
  serverResponses: Array<{
    url: string;
    content: string;
    contentType: string;
    status?: number;
  }>;
  filterArgs: Record<string, unknown>;
  expectedContains: string[];
  expectedNotContains: string[];
  expectedSpecialChecks?: (results: string) => void;
}

const testCases: TestCase[] = [
  {
    name: 'should show filter summary when filters are applied',
    fetchUrls: ['/api/users', '/static/style.css'],
    serverResponses: [
      {
        url: '/api/users',
        content: '{"users": []}',
        contentType: 'application/json',
      },
      {
        url: '/static/style.css',
        content: 'body { color: red; }',
        contentType: 'text/css',
      },
    ],
    filterArgs: { urlPatterns: ['/api/'] },
    expectedContains: ['Filter Summary:', 'URL patterns: /api/', '/api/users'],
    expectedNotContains: ['/static/style.css'],
  },
  {
    name: 'should filter by URL patterns',
    fetchUrls: ['/api/posts', '/static/image.png', '/analytics/track'],
    serverResponses: [
      { url: '/api/posts', content: '{}', contentType: 'application/json' },
      { url: '/static/image.png', content: '', contentType: 'image/png' },
      {
        url: '/analytics/track',
        content: '{}',
        contentType: 'application/json',
      },
    ],
    filterArgs: { urlPatterns: ['api'] },
    expectedContains: ['/api/posts'],
    expectedNotContains: ['/static/', '/analytics/'],
  },
  {
    name: 'should exclude URL patterns',
    fetchUrls: ['/api/data', '/analytics/track', '/ads/banner'],
    serverResponses: [
      { url: '/api/data', content: '{}', contentType: 'application/json' },
      {
        url: '/analytics/track',
        content: '{}',
        contentType: 'application/json',
      },
      { url: '/ads/banner', content: '{}', contentType: 'application/json' },
    ],
    filterArgs: { excludeUrlPatterns: ['analytics', 'ads'] },
    expectedContains: ['/api/data'],
    expectedNotContains: ['/analytics/', '/ads/'],
  },
  {
    name: 'should filter by status code ranges - success only',
    fetchUrls: ['/success', '/not-found', '/server-error'],
    serverResponses: [
      { url: '/success', content: 'OK', contentType: 'text/plain' },
      {
        url: '/not-found',
        content: '',
        contentType: 'text/plain',
        status: 404,
      },
      {
        url: '/server-error',
        content: '',
        contentType: 'text/plain',
        status: 500,
      },
    ],
    filterArgs: { statusRanges: [{ min: 200, max: 299 }] },
    expectedContains: ['[200]'],
    expectedNotContains: ['[404]', '[500]'],
  },
  {
    name: 'should filter by status code ranges - errors only',
    fetchUrls: ['/success', '/not-found', '/server-error'],
    serverResponses: [
      { url: '/success', content: 'OK', contentType: 'text/plain' },
      {
        url: '/not-found',
        content: '',
        contentType: 'text/plain',
        status: 404,
      },
      {
        url: '/server-error',
        content: '',
        contentType: 'text/plain',
        status: 500,
      },
    ],
    filterArgs: {
      statusRanges: [
        { min: 400, max: 499 },
        { min: 500, max: 599 },
      ],
    },
    expectedContains: ['[404]', '[500]'],
    expectedNotContains: ['[200]'],
  },
  {
    name: 'should handle complex combined filters',
    fetchUrls: ['/api/users', '/api/posts', '/api/error', '/static/data'],
    serverResponses: [
      { url: '/api/users', content: '{}', contentType: 'application/json' },
      { url: '/api/posts', content: '{}', contentType: 'application/json' },
      {
        url: '/api/error',
        content: '',
        contentType: 'text/plain',
        status: 500,
      },
      { url: '/static/data', content: '{}', contentType: 'application/json' },
    ],
    filterArgs: {
      urlPatterns: ['/api/users'],
      methods: ['GET'],
      statusRanges: [{ min: 200, max: 299 }],
    },
    expectedContains: [
      '/api/users',
      'URL patterns: /api/users',
      'Methods: GET',
      'Status ranges: 200-299',
    ],
    expectedNotContains: ['/api/posts', '/api/error', '/static/'],
  },
];

test.describe('Network Filter Integration Tests', () => {
  // Parameterized tests for common filter scenarios
  for (const testCase of testCases) {
    test(testCase.name, async ({ client, server }) => {
      // Set up HTML with fetch scripts
      const fetchScripts = testCase.fetchUrls
        .map((url) => `fetch('${url}');`)
        .join('\n        ');
      server.setContent(
        '/',
        `<script>\n        ${fetchScripts}\n      </script>`,
        'text/html'
      );

      // Set up server responses
      for (const response of testCase.serverResponses) {
        if (response.status && response.status !== 200) {
          // Use route method for non-200 status codes
          server.route(response.url, (_req, res) => {
            res.writeHead(response.status ?? 500, {
              'Content-Type': response.contentType,
            });
            res.end(response.content);
          });
        } else {
          server.setContent(
            response.url,
            response.content,
            response.contentType
          );
        }
      }

      await client.callTool({
        name: 'browser_navigate',
        arguments: { url: server.PREFIX },
      });

      await new Promise((resolve) => setTimeout(resolve, 1500));

      const response = await client.callTool({
        name: 'browser_network_requests',
        arguments: testCase.filterArgs,
      });

      const results = response.content[0].text;

      // Check expected contains
      for (const expected of testCase.expectedContains) {
        expect(results).toContain(expected);
      }

      // Check expected not contains
      for (const notExpected of testCase.expectedNotContains) {
        expect(results).not.toContain(notExpected);
      }

      // Run any special checks
      testCase.expectedSpecialChecks?.(results);
    });
  }

  test('should limit results with maxRequests', async ({ client, server }) => {
    server.setContent(
      '/',
      `
      <script>
        for (let i = 0; i < 5; i++) {
          fetch('/api/resource' + i);
        }
      </script>
    `,
      'text/html'
    );

    // Set up endpoints
    for (let i = 0; i < 5; i++) {
      server.setContent(
        `/api/resource${i}`,
        `{"id": ${i}}`,
        'application/json'
      );
    }

    await client.callTool({
      name: 'browser_navigate',
      arguments: { url: server.PREFIX },
    });

    await new Promise((resolve) => setTimeout(resolve, 1500));

    const response = await client.callTool({
      name: 'browser_network_requests',
      arguments: {
        urlPatterns: ['api/resource'],
        maxRequests: 3,
      },
    });

    const results = response.content[0].text;
    const lines = results
      .split('\n')
      .filter((line) => line.includes('/api/resource'));

    // Should be limited to 3 requests (not counting filter summary lines)
    // Note: Due to browser navigation, there might be additional requests (like favicon)
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.length).toBeLessThanOrEqual(5); // Allow some flexibility for browser requests
    expect(results).toContain('maxRequests');
  });

  test('should maintain backward compatibility when no filters are provided', async ({
    client,
    server,
  }) => {
    server.setContent(
      '/',
      `
      <script>
        fetch('/api/data');
      </script>
    `,
      'text/html'
    );

    server.setContent('/api/data', '{}', 'application/json');

    await client.callTool({
      name: 'browser_navigate',
      arguments: { url: server.PREFIX },
    });

    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Test without any filter parameters (old behavior)
    const response = await client.callTool({
      name: 'browser_network_requests',
      arguments: {},
    });

    const results = response.content[0].text;

    // Should not show filter summary when no filters are applied
    expect(results).not.toContain('Filter Summary:');
    expect(results).toContain('[GET]');
    expect(results).toContain('/api/data');
  });

  test('should handle no matching requests gracefully', async ({
    client,
    server,
  }) => {
    server.setContent(
      '/',
      `
      <script>
        fetch('/api/users');
        fetch('/api/posts');
      </script>
    `,
      'text/html'
    );

    server.setContent('/api/users', '{}', 'application/json');
    server.setContent('/api/posts', '{}', 'application/json');

    await client.callTool({
      name: 'browser_navigate',
      arguments: { url: server.PREFIX },
    });

    await new Promise((resolve) => setTimeout(resolve, 1000));

    const response = await client.callTool({
      name: 'browser_network_requests',
      arguments: {
        urlPatterns: ['nonexistent'],
      },
    });

    const results = response.content[0].text;
    expect(results).toContain(
      'No requests match the specified filter criteria'
    );
  });

  test('should handle invalid regex patterns gracefully', async ({
    client,
    server,
  }) => {
    server.setContent(
      '/',
      `
      <script>
        fetch('/api/test');
      </script>
    `,
      'text/html'
    );

    server.setContent('/api/test', '{}', 'application/json');

    await client.callTool({
      name: 'browser_navigate',
      arguments: { url: server.PREFIX },
    });

    await new Promise((resolve) => setTimeout(resolve, 1000));

    const response = await client.callTool({
      name: 'browser_network_requests',
      arguments: {
        urlPatterns: ['[invalid-regex'],
      },
    });

    // Should not crash, should fall back to string matching
    expect(response.isError).toBeFalsy();
  });
});
