/**
 * browser_diagnose Tool Tests
 */

import { test, expect } from './fixtures.js';

test('browser_diagnose - basic page analysis', async ({ client, server }) => {
  server.setContent('/', `
    <div>
      <button>Click Me</button>
      <iframe src="data:text/html,<h1>Frame Content</h1>"></iframe>
      <input type="text" placeholder="Enter text">
    </div>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  const result = await client.callTool({
    name: 'browser_diagnose',
    arguments: {
      expectation: {
        includeSnapshot: false
      }
    }
  });

  expect(result.isError).toBeFalsy();
  expect(result.content[0].text).toContain('Page Diagnostic Report');
  expect(result.content[0].text).toContain('iframes detected:');
  expect(result.content[0].text).toContain('Total visible elements:');
});

test('browser_diagnose - with element search', async ({ client, server }) => {
  server.setContent('/', `
    <div>
      <button data-action="submit">Submit</button>
      <button data-action="cancel">Cancel</button>
    </div>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  const result = await client.callTool({
    name: 'browser_diagnose',
    arguments: {
      searchForElements: {
        text: 'Submit',
        role: 'button'
      },
      expectation: {
        includeSnapshot: false
      }
    }
  });

  expect(result.isError).toBeFalsy();
  expect(result.content[0].text).toContain('Element Search Results');
  expect(result.content[0].text).toContain('Submit');
});

test('browser_diagnose - performance analysis', async ({ client, server }) => {
  server.setContent('/', `
    <div>
      <button>Test</button>
    </div>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  const result = await client.callTool({
    name: 'browser_diagnose',
    arguments: {
      includePerformanceMetrics: true,
      expectation: {
        includeSnapshot: false
      }
    }
  });

  expect(result.isError).toBeFalsy();
  expect(result.content[0].text).toContain('Performance Metrics');
});

test('browser_diagnose - comprehensive report', async ({ client, server }) => {
  server.setContent('/', `
    <div>
      <h1>Test Page</h1>
      <form>
        <input type="text" name="username" placeholder="Username">
        <input type="password" name="password" placeholder="Password">
        <button type="submit">Login</button>
      </form>
      <iframe src="about:blank"></iframe>
    </div>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  const result = await client.callTool({
    name: 'browser_diagnose',
    arguments: {
      searchForElements: {
        role: 'textbox'
      },
      includePerformanceMetrics: true,
      includeAccessibilityInfo: true,
      expectation: {
        includeSnapshot: false
      }
    }
  });

  expect(result.isError).toBeFalsy();
  expect(result.content[0].text).toContain('Page Diagnostic Report');
  expect(result.content[0].text).toContain('Element Search Results');
  expect(result.content[0].text).toContain('Performance Metrics');
  expect(result.content[0].text).toContain('Accessibility Information');
});

test('browser_diagnose - with troubleshooting suggestions', async ({ client, server }) => {
  server.setContent('/', `
    <div>
      <iframe src="data:text/html,<button>Inside Frame</button>"></iframe>
      <button style="display: none;">Hidden Button</button>
    </div>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  const result = await client.callTool({
    name: 'browser_diagnose',
    arguments: {
      includeTroubleshootingSuggestions: true,
      expectation: {
        includeSnapshot: false
      }
    }
  });

  expect(result.isError).toBeFalsy();
  expect(result.content[0].text).toContain('Troubleshooting Suggestions');
  expect(result.content[0].text).toContain('iframe');
});