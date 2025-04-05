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
      testCases: [
        {
          testDefinition: "Validate that the read more button opens the blog posts and the content loads",
        },
        {
          testDefinition: "Validate that the toggle theme can be opened",
          expect: "The background color of the website should turn to black if white, or turn to white if black"
        },
      ],
      urls: ['http://localhost:3000']
    }
  });

  console.log("response: ", response);
  await fs.writeFile('qa_response.txt', JSON.stringify(response, null, 2));
});