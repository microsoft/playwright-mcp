import { test, expect } from './fixtures';

test('test tool list', async ({ qaClient }) => {
    const { tools: qaTools } = await qaClient.listTools();
    expect(qaTools.map(t => t.name)).toEqual([
      'browser_qa'
    ]);
});

test('test qa with single url', async ({ qaClient }) => {
  const response = await qaClient.callTool({
    name: 'browser_qa',
    arguments: {
      urls: ['http://localhost:3000']
    }
  });

  // Verify response contains snapshot and batch information
  console.log(response)
});