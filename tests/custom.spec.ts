import { test, expect } from './fixtures';
import fs from 'fs/promises';

test('execute custom JavaScript from file', async ({ client }) => {
  const filePath = 'test-script.js';
  const scriptContent = `
    console.log('Hello from custom script');
    document.body.innerHTML = '<h1>Hello, world!</h1>';
  `;
  await fs.writeFile(filePath, scriptContent);

  await client.callTool({
    name: 'browser_navigate',
    arguments: {
      url: 'data:text/html,<html><title>Title</title><body></body></html>',
    },
  });

  const response = await client.callTool({
    name: 'browser_custom_javascript',
    arguments: {
      filePath,
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

  const pageContent = await client.callTool({
    name: 'browser_snapshot',
  });

  expect(pageContent).toHaveTextContent(`
- Page URL: data:text/html,<html><title>Title</title><body></body></html>
- Page Title: Title
- Page Snapshot
\`\`\`yaml
- heading level=1 "Hello, world!"
\`\`\`
  `);

  await fs.unlink(filePath);
});

test('execute custom JavaScript function from file', async ({ client }) => {
  const filePath = 'test-function-script.js';
  const scriptContent = `
    function greet(name) {
      console.log('Hello, ' + name + '!');
    }
  `;
  await fs.writeFile(filePath, scriptContent);

  await client.callTool({
    name: 'browser_navigate',
    arguments: {
      url: 'data:text/html,<html><title>Title</title><body></body></html>',
    },
  });

  const response = await client.callTool({
    name: 'browser_custom_javascript',
    arguments: {
      filePath,
      functionName: 'greet',
      functionArgs: ['Playwright'],
    },
  });

  expect(response).toHaveTextContent('Executed custom JavaScript from file: test-function-script.js');

  const resource = await client.readResource({
    uri: 'browser://console',
  });

  expect(resource.contents).toEqual([{
    uri: 'browser://console',
    mimeType: 'text/plain',
    text: '[LOG] Hello, Playwright!',
  }]);

  await fs.unlink(filePath);
});
