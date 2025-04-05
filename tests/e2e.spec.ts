import { test, expect } from './fixtures';
import fs from 'fs/promises';

test('test tool list', async ({ endtoendClient }) => {
    const { tools: qaTools } = await endtoendClient.listTools();
    expect(qaTools.map(t => t.name)).toEqual([
      'browser_endtoend'
    ]);
});

test('test qa with single url', async ({ endtoendClient }) => {
  const response = await endtoendClient.callTool({
    name: 'browser_endtoend',
    arguments: {
      testCases: ["Validate that you can click on readmore button for each blog posts and they load", "Validate that the theme toggle works"],
      urls: ['http://localhost:3000']
    }
  });

  console.log("response: ", response);
  await fs.writeFile('qa_response.txt', JSON.stringify(response, null, 2));
});