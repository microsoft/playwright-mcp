import { z } from 'zod';
import { quote } from '../javascript.js';
import { expectationSchema } from '../schemas/expectation.js';
import { generateKeyPressCode } from '../utils/common-formatters.js';
import { baseElementSchema as elementSchema } from './base-tool-handler.js';
import { defineTabTool } from './tool.js';
import { generateLocator } from './utils.js';

const pressKey = defineTabTool({
  capability: 'core',
  schema: {
    name: 'browser_press_key',
    title: 'Press a key',
    description:
      'Press a key on the keyboard.Common keys:Enter,Escape,ArrowUp/Down/Left/Right,Tab,Backspace.expectation:{includeSnapshot:false} for navigation keys,true for content changes.CONSIDER batch_execute for multiple key presses.',
    inputSchema: z.object({
      key: z
        .string()
        .describe(
          'Name of the key to press or a character to generate, such as `ArrowLeft` or `a`'
        ),
      expectation: expectationSchema,
    }),
    type: 'destructive',
  },
  handle: async (tab, params, response) => {
    response.addCode(`// Press ${params.key}`);
    response.addCode(generateKeyPressCode(params.key));
    await tab.waitForCompletion(async () => {
      await tab.page.keyboard.press(params.key);
    });
    // If expectation includes snapshot, capture it now after navigation
    if (params.expectation?.includeSnapshot) {
      const newSnapshot = await tab.captureSnapshot();
      response.setTabSnapshot(newSnapshot);
    }
  },
});
const typeSchema = elementSchema.extend({
  element: z
    .string()
    .describe(
      'Human-readable element description used to obtain permission to interact with the element'
    ),
  ref: z
    .string()
    .describe('Exact target element reference from the page snapshot'),
  text: z.string().describe('Text to type into the element'),
  submit: z
    .boolean()
    .optional()
    .describe('Whether to submit entered text (press Enter after)'),
  slowly: z
    .boolean()
    .optional()
    .describe(
      'Whether type one character at a time. Useful for triggering key handlers in the page. By default entire text is filled in at once.'
    ),
  expectation: expectationSchema,
});
const type = defineTabTool({
  capability: 'core',
  schema: {
    name: 'browser_type',
    title: 'Type text',
    description: `Type text into editable element.FOR FORMS:Use batch_execute to fill multiple fields efficiently.slowly:true for auto-complete fields,submit:true to press Enter after.expectation:{includeSnapshot:false} when filling multiple fields(use batch),true for final verification.snapshotOptions:{selector:"form"} to focus on form only.diffOptions:{enabled:true} shows only what changed in form.`,
    inputSchema: typeSchema,
    type: 'destructive',
  },
  handle: async (tab, params, response) => {
    const locator = await tab.refLocator(params);
    await tab.waitForCompletion(async () => {
      if (params.slowly) {
        response.addCode(
          `await page.${await generateLocator(locator)}.pressSequentially(${quote(params.text)});`
        );
        await locator.pressSequentially(params.text);
      } else {
        response.addCode(
          `await page.${await generateLocator(locator)}.fill(${quote(params.text)});`
        );
        await locator.fill(params.text);
      }
      if (params.submit) {
        response.addCode(
          `await page.${await generateLocator(locator)}.press('Enter');`
        );
        await locator.press('Enter');
      }
    });
  },
});
export default [pressKey, type];
