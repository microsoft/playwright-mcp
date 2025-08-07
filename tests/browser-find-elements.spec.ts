/**
 * browser_find_elements Tool Tests
 */

import { test, expect } from './fixtures.js';

test('browser_find_elements - find by multiple criteria', async ({ client, server }) => {
  server.setContent('/', `
    <div>
      <button class="btn">Submit</button>
      <input type="submit" value="Submit">
      <a role="button">Link Button</a>
    </div>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  const result = await client.callTool({
    name: 'browser_find_elements',
    arguments: {
      searchCriteria: {
        text: 'Submit',
        role: 'button'
      },
      maxResults: 5,
      expectation: {
        includeSnapshot: false
      }
    }
  });

  expect(result.isError).toBeFalsy();
  expect(result.content[0].text).toContain('Found');
});

test('browser_find_elements - find by tag name', async ({ client, server }) => {
  server.setContent('/', `
    <form>
      <input type="text" name="username">
      <input type="email" name="email">
    </form>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  const result = await client.callTool({
    name: 'browser_find_elements',
    arguments: {
      searchCriteria: {
        tagName: 'input'
      },
      maxResults: 10,
      expectation: {
        includeSnapshot: false
      }
    }
  });

  expect(result.isError).toBeFalsy();
  expect(result.content[0].text).toContain('Found');
});

test('browser_find_elements - find by attributes', async ({ client, server }) => {
  server.setContent('/', `
    <div>
      <button data-action="save">Save</button>
      <button data-action="cancel">Cancel</button>
    </div>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  const result = await client.callTool({
    name: 'browser_find_elements',
    arguments: {
      searchCriteria: {
        attributes: {
          'data-action': 'save'
        }
      },
      expectation: {
        includeSnapshot: false
      }
    }
  });

  expect(result.isError).toBeFalsy();
  expect(result.content[0].text).toContain('Found');
});

test('browser_find_elements - handle no matches', async ({ client, server }) => {
  server.setContent('/', `
    <div>
      <span>No buttons here</span>
    </div>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  const result = await client.callTool({
    name: 'browser_find_elements',
    arguments: {
      searchCriteria: {
        role: 'button'
      },
      expectation: {
        includeSnapshot: false
      }
    }
  });

  expect(result.isError).toBeFalsy();
  expect(result.content[0].text).toContain('No elements found');
});

test('browser_find_elements - limit results', async ({ client, server }) => {
  const buttons = Array.from({ length: 10 }, (_, i) => `<button>Button ${i}</button>`).join('');
  server.setContent('/', `<div>${buttons}</div>`, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  const result = await client.callTool({
    name: 'browser_find_elements',
    arguments: {
      searchCriteria: {
        tagName: 'button'
      },
      maxResults: 3,
      expectation: {
        includeSnapshot: false
      }
    }
  });

  expect(result.isError).toBeFalsy();
  expect(result.content[0].text).toContain('Found');
});
