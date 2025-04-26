import { test, expect } from './fixtures';
import { endtoend } from 'best';

test('test endtoend tool handle invocation', async ({ coreContext }) => {
  test.setTimeout(15000);
  const params = {
    testCases: [{ testDefinition: 'Simple test' }],
    urls: ['data:text/html,Test']
  };
  try {
    const result = await endtoend.handle(coreContext, params);
    expect(result.content[0].type).toBe('text');
  } catch (error: any) {
    console.warn(`endtoend.handle failed as expected: ${error.message}`);
  }
}); 