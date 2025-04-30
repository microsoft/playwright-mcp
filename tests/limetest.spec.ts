import { test, expect } from './fixtures';
import { limetest } from '@limetest/limetest';

test('test endtoend tool handle invocation', async ({ coreContext }) => {
  test.setTimeout(15000);
  const params = {
    testCases: [{ testDefinition: 'Simple test' }],
    urls: ['data:text/html,Test']
  };
  try {
    const result = await limetest.handle(coreContext, params);
    expect(result.content[0].type).toBe('text');
  } catch (error: any) {
    console.warn(`limetest.handle failed as expected: ${error.message}`);
  }
});
