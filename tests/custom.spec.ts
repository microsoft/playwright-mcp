import { test, expect } from './fixtures';
import fs from 'fs';
import path from 'path';

test.describe('Custom JavaScript Execution', () => {
  test.only('execute custom JavaScript from file', async ({ client }) => {
    const scriptPath = 'test-script.js';
    
    // Create a test script file
    fs.writeFileSync(scriptPath, `
      console.log("Hello from custom script");
    `);

    await client.callTool({
      name: 'browser_navigate',
      arguments: {
        url: 'data:text/html,<html><title>Title</title><body></body></html>',
      },
    });

    const response = await client.callTool({
      name: 'browser_custom_javascript',
      arguments: {
        filePath: scriptPath,
      },
    });

    expect(response.content[0].text).toContain('Executed custom JavaScript from file: test-script.js');

    const resource = await client.readResource({
      uri: 'browser://console',
    });

    expect(resource.contents).toEqual([{
      uri: 'browser://console',
      mimeType: 'text/plain',
      text: '[LOG] Hello from custom script',
    }]);

    // Clean up the test script file
    fs.rm(scriptPath);
  });

  test('execute generated JavaScript code', async ({ client }) => {
    const scriptContent = 'console.log("Hello from generated script");';

    await client.callTool({
      name: 'browser_navigate',
      arguments: {
        url: 'data:text/html,<html><title>Title</title><body></body></html>',
      },
    });

    const response = await client.callTool({
      name: 'browser_execute_generated_javascript',
      arguments: {
        scriptContent,
      },
    });

    expect(response.content[0].text).toContain('Executed generated JavaScript code');

    const resource = await client.readResource({
      uri: 'browser://console',
    });

    expect(resource.contents).toEqual([{
      uri: 'browser://console',
      mimeType: 'text/plain',
      text: '[LOG] Hello from generated script',
    }]);
  });
});
