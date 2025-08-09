import { z } from 'zod';
import { expectationSchema } from '../schemas/expectation.js';
import { defineTool } from './tool.js';

const wait = defineTool({
  capability: 'core',
  schema: {
    name: 'browser_wait_for',
    title: 'Wait for',
    description: `Wait for text to appear/disappear or time to pass.PREFER text-based wait over time for reliability.For loading states:wait for text:"Loading..." textGone:true.For dynamic content:wait for specific text to appear.expectation:{includeSnapshot:true,snapshotOptions:{selector:"#status"},diffOptions:{enabled:true}} shows only what changed.AVOID:fixed time waits unless necessary.`,
    inputSchema: z.object({
      time: z.number().optional().describe('The time to wait in seconds'),
      text: z.string().optional().describe('The text to wait for'),
      textGone: z
        .string()
        .optional()
        .describe('The text to wait for to disappear'),
      expectation: expectationSchema,
    }),
    type: 'readOnly',
  },
  handle: async (context, params, response) => {
    if (!(params.text || params.textGone || params.time)) {
      throw new Error('Either time, text or textGone must be provided');
    }
    if (params.time) {
      await new Promise((f) =>
        setTimeout(f, Math.min(30_000, (params.time ?? 0) * 1000))
      );
    }
    const tab = context.currentTabOrDie();
    const locator = params.text
      ? tab.page.getByText(params.text).first()
      : undefined;
    const goneLocator = params.textGone
      ? tab.page.getByText(params.textGone).first()
      : undefined;
    if (goneLocator) {
      await goneLocator.waitFor({ state: 'hidden' });
    }
    if (locator) {
      await locator.waitFor({ state: 'visible' });
    }
    response.addResult(
      `Waited for ${params.text ?? params.textGone ?? params.time}`
    );
    response.setIncludeSnapshot();
  },
});
export default [wait];
