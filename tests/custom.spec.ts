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
        document.body.innerHTML = '<h1>Hello, generated world!</h1>';
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

  const pageContent = await client.callTool({
    name: 'browser_snapshot',
  });

  expect(pageContent).toHaveTextContent(`
- Page URL: data:text/html,<html><title>Title</title><body></body></html>
- Page Title: Title
- Page Snapshot
\`\`\`yaml
- heading level=1 "Hello, generated world!"
\`\`\`
  `);
});
