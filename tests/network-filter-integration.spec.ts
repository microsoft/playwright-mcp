/**
 * Integration tests for network filter functionality in network.ts tool
 * Testing the new filtering capabilities without breaking existing behavior
 */

import { expect, test } from './fixtures.js';

test.describe('Network Filter Integration Tests', () => {
  test('should show filter summary when filters are applied', async ({
    client,
    server,
  }) => {
    server.setContent(
      '/',
      `
      <script>
        fetch('/api/users');
        fetch('/static/style.css');
      </script>
    `,
      'text/html'
    );

    server.setContent('/api/users', '{"users": []}', 'application/json');
    server.setContent('/static/style.css', 'body { color: red; }', 'text/css');

    await client.callTool({
      name: 'browser_navigate',
      arguments: { url: server.PREFIX },
    });

    await new Promise((resolve) => setTimeout(resolve, 1000));

    const response = await client.callTool({
      name: 'browser_network_requests',
      arguments: {
        urlPatterns: ['/api/'],
      },
    });

    const results = response.content[0].text;

    // Should include filter summary when filters are used
    expect(results).toContain('Filter Summary:');
    expect(results).toContain('URL patterns: /api/');
    expect(results).toContain('/api/users');
    expect(results).not.toContain('/static/style.css');
  });

  test('should filter by URL patterns', async ({ client, server }) => {
    server.setContent(
      '/',
      `
      <script>
        fetch('/api/posts');
        fetch('/static/image.png');
        fetch('/analytics/track');
      </script>
    `,
      'text/html'
    );

    server.setContent('/api/posts', '{}', 'application/json');
    server.setContent('/static/image.png', '', 'image/png');
    server.setContent('/analytics/track', '{}', 'application/json');

    await client.callTool({
      name: 'browser_navigate',
      arguments: { url: server.PREFIX },
    });

    await new Promise((resolve) => setTimeout(resolve, 1000));

    const response = await client.callTool({
      name: 'browser_network_requests',
      arguments: {
        urlPatterns: ['api'],
      },
    });

    const results = response.content[0].text;
    expect(results).toContain('/api/posts');
    expect(results).not.toContain('/static/');
    expect(results).not.toContain('/analytics/');
  });

  test('should exclude URL patterns', async ({ client, server }) => {
    server.setContent(
      '/',
      `
      <script>
        fetch('/api/data');
        fetch('/analytics/track');
        fetch('/ads/banner');
      </script>
    `,
      'text/html'
    );

    server.setContent('/api/data', '{}', 'application/json');
    server.setContent('/analytics/track', '{}', 'application/json');
    server.setContent('/ads/banner', '{}', 'application/json');

    await client.callTool({
      name: 'browser_navigate',
      arguments: { url: server.PREFIX },
    });

    await new Promise((resolve) => setTimeout(resolve, 1000));

    const response = await client.callTool({
      name: 'browser_network_requests',
      arguments: {
        excludeUrlPatterns: ['analytics', 'ads'],
      },
    });

    const results = response.content[0].text;
    expect(results).toContain('/api/data');
    expect(results).not.toContain('/analytics/');
    expect(results).not.toContain('/ads/');
  });

  test('should filter by HTTP methods', async ({ client, server }) => {
    server.setContent(
      '/',
      `
      <form method="post" action="/submit">
        <input name="data" value="test">
        <button type="submit">Submit</button>
      </form>
      <script>
        fetch('/api/get-data'); // GET request
        setTimeout(() => {
          document.querySelector('form').submit(); // POST request
        }, 100);
      </script>
    `,
      'text/html'
    );

    server.setContent('/api/get-data', '{}', 'application/json');
    server.setContent('/submit', 'Success', 'text/plain');

    await client.callTool({
      name: 'browser_navigate',
      arguments: { url: server.PREFIX },
    });

    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Test GET requests only
    const getResponse = await client.callTool({
      name: 'browser_network_requests',
      arguments: {
        methods: ['GET'],
      },
    });

    const getResults = getResponse.content[0].text;
    expect(getResults).toContain('[GET]');
    expect(getResults).not.toContain('[POST]');

    // Test POST requests only
    const postResponse = await client.callTool({
      name: 'browser_network_requests',
      arguments: {
        methods: ['POST'],
      },
    });

    const postResults = postResponse.content[0].text;
    expect(postResults).toContain('[POST]');
    expect(postResults).not.toContain('/api/get-data'); // This is GET, so shouldn't appear
  });

  test('should filter by status code ranges', async ({ client, server }) => {
    server.setContent(
      '/',
      `
      <script>
        fetch('/success');
        fetch('/not-found').catch(() => {});
        fetch('/server-error').catch(() => {});
      </script>
    `,
      'text/html'
    );

    server.setContent('/success', 'OK', 'text/plain');
    server.setStatus('/not-found', 404);
    server.setStatus('/server-error', 500);

    await client.callTool({
      name: 'browser_navigate',
      arguments: { url: server.PREFIX },
    });

    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Test success status codes only
    const successResponse = await client.callTool({
      name: 'browser_network_requests',
      arguments: {
        statusRanges: [{ min: 200, max: 299 }],
      },
    });

    const successResults = successResponse.content[0].text;
    expect(successResults).toContain('[200]');
    expect(successResults).not.toContain('[404]');
    expect(successResults).not.toContain('[500]');

    // Test error status codes
    const errorResponse = await client.callTool({
      name: 'browser_network_requests',
      arguments: {
        statusRanges: [
          { min: 400, max: 499 },
          { min: 500, max: 599 },
        ],
      },
    });

    const errorResults = errorResponse.content[0].text;
    expect(errorResults).toContain('[404]');
    expect(errorResults).toContain('[500]');
    expect(errorResults).not.toContain('[200]');
  });

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

    await new Promise((resolve) => setTimeout(resolve, 1000));

    const response = await client.callTool({
      name: 'browser_network_requests',
      arguments: {
        urlPatterns: ['/api/resource'],
        maxRequests: 3,
      },
    });

    const results = response.content[0].text;
    const lines = results
      .split('\n')
      .filter((line) => line.includes('/api/resource'));

    // Should be limited to 3 requests (not counting filter summary lines)
    expect(lines.length).toBeLessThanOrEqual(3);
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

    await new Promise((resolve) => setTimeout(resolve, 500));

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

    await new Promise((resolve) => setTimeout(resolve, 500));

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

    await new Promise((resolve) => setTimeout(resolve, 500));

    const response = await client.callTool({
      name: 'browser_network_requests',
      arguments: {
        urlPatterns: ['[invalid-regex'],
      },
    });

    // Should not crash, should fall back to string matching
    expect(response.isError).toBeFalsy();
  });

  test('should handle complex combined filters', async ({ client, server }) => {
    server.setContent(
      '/',
      `
      <script>
        fetch('/api/users', { method: 'GET' });
        fetch('/api/posts', { method: 'POST', body: '{}' });
        fetch('/api/error', { method: 'GET' });
        fetch('/static/data', { method: 'GET' });
      </script>
    `,
      'text/html'
    );

    server.setContent('/api/users', '{}', 'application/json');
    server.setContent('/api/posts', '{}', 'application/json');
    server.setStatus('/api/error', 500);
    server.setContent('/static/data', '{}', 'application/json');

    await client.callTool({
      name: 'browser_navigate',
      arguments: { url: server.PREFIX },
    });

    await new Promise((resolve) => setTimeout(resolve, 1000));

    const response = await client.callTool({
      name: 'browser_network_requests',
      arguments: {
        urlPatterns: ['/api/'],
        methods: ['GET'],
        statusRanges: [{ min: 200, max: 299 }],
      },
    });

    const results = response.content[0].text;

    // Should only include GET requests to /api/ with 2xx status
    expect(results).toContain('/api/users');
    expect(results).not.toContain('/api/posts'); // POST method
    expect(results).not.toContain('/api/error'); // 500 status
    expect(results).not.toContain('/static/'); // Wrong URL pattern

    // Should show all filter criteria
    expect(results).toContain('URL patterns: /api/');
    expect(results).toContain('Methods: GET');
    expect(results).toContain('Status ranges: 200-299');
  });
});
