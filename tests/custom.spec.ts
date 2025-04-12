import { test, expect } from './fixtures';
import fs from 'fs/promises';

test('execute custom JavaScript from file', async ({ client }) => {
  await client.callTool({
    name: 'browser_navigate',
    arguments: {
      url: 'data:text/html,<html><title>Title</title><body></body></html>',
    },
  });

  const response = await client.callTool({
    name: 'browser_custom_javascript',
    arguments: {
      filePath: 'test-script.js',
    },
  });

  expect(response).toHaveTextContent('Executed custom JavaScript from file: test-script.js');

  const resource = await client.readResource({
    uri: 'browser://console',
  });

  expect(resource.contents).toEqual([{
    uri: 'browser://console',
    mimeType: 'text/plain',
    text: '[LOG] Hello from custom script',
  }]);
});

test('execute generated JavaScript code', async ({ client }) => {
  await client.callTool({
    name: 'browser_navigate',
    arguments: {
      url: 'data:text/html,<html><title>Title</title><body></body></html>',
    },
  });

  const response = await client.callTool({
    name: 'browser_execute_generated_javascript',
    arguments: {
      scriptContent: `
        console.log('Hello from generated script');
        document.body.innerHTML = '<h1>Generated Hello, world!</h1>';
      `,
    },
  });

  expect(response).toHaveTextContent('Executed generated JavaScript code');

  const resource = await client.readResource({
    uri: 'browser://console',
  });

  expect(resource.contents).toEqual([{
    uri: 'browser://console',
    mimeType: 'text/plain',
    text: '[LOG] Hello from generated script',
  }]);
});
