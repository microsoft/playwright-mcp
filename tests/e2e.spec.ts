import { test, expect } from './fixtures';

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
      testCases: ["Validate that the blog posts are loading"],
      urls: ['http://localhost:3000']
    }
  });

  // Verify response contains snapshot and batch information
  console.log(response)
});