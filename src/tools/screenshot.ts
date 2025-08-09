import type * as playwright from 'playwright';
import { z } from 'zod';
import { formatObject } from '../javascript.js';
import { expectationSchema } from '../schemas/expectation.js';
import { defineTabTool } from './tool.js';
import { generateLocator } from './utils.js';

const screenshotSchema = z
  .object({
    type: z
      .enum(['png', 'jpeg'])
      .default('png')
      .describe('Image format for the screenshot. Default is png.'),
    filename: z
      .string()
      .optional()
      .describe(
        'File name to save the screenshot to. Defaults to `page-{timestamp}.{png|jpeg}` if not specified.'
      ),
    element: z
      .string()
      .optional()
      .describe(
        'Human-readable element description used to obtain permission to screenshot the element. If not provided, the screenshot will be taken of viewport. If element is provided, ref must be provided too.'
      ),
    ref: z
      .string()
      .optional()
      .describe(
        'Exact target element reference from the page snapshot. If not provided, the screenshot will be taken of viewport. If ref is provided, element must be provided too.'
      ),
    fullPage: z
      .boolean()
      .optional()
      .describe(
        'When true, takes a screenshot of the full scrollable page, instead of the currently visible viewport. Cannot be used with element screenshots.'
      ),
    expectation: expectationSchema,
  })
  .refine(
    (data) => {
      return !!data.element === !!data.ref;
    },
    {
      message: 'Both element and ref must be provided or neither.',
      path: ['ref', 'element'],
    }
  )
  .refine(
    (data) => {
      return !(data.fullPage && (data.element || data.ref));
    },
    {
      message: 'fullPage cannot be used with element screenshots.',
      path: ['fullPage'],
    }
  );
const screenshot = defineTabTool({
  capability: 'core',
  schema: {
    name: 'browser_take_screenshot',
    title: 'Take a screenshot',
    description: `Take a screenshot of current page.Returns image data.expectation:{includeSnapshot:false} to avoid redundant accessibility tree(screenshot≠snapshot).imageOptions:{quality:50,format:"jpeg"} for 70% size reduction.fullPage:true for entire page,element+ref for specific element.USE CASES:visual verification,documentation,error capture.`,
    inputSchema: screenshotSchema,
    type: 'readOnly',
  },
  handle: async (tab, params, response) => {
    const fileType = params.type ?? 'png';
    const fileName = await tab.context.outputFile(
      params.filename ?? `page-${new Date().toISOString()}.${fileType}`
    );
    const options: playwright.PageScreenshotOptions = {
      type: fileType,
      quality: fileType === 'png' ? undefined : 90,
      scale: 'css',
      path: fileName,
      ...(params.fullPage !== undefined && { fullPage: params.fullPage }),
    };
    const isElementScreenshot = params.element && params.ref;
    let screenshotTarget: string;
    if (isElementScreenshot && params.element) {
      screenshotTarget = params.element;
    } else if (params.fullPage) {
      screenshotTarget = 'full page';
    } else {
      screenshotTarget = 'viewport';
    }
    response.addCode(
      `// Screenshot ${screenshotTarget} and save it as ${fileName}`
    );
    // Only get snapshot when element screenshot is needed
    const locator =
      isElementScreenshot && params.element && params.ref
        ? await tab.refLocator({ element: params.element, ref: params.ref })
        : null;
    if (locator) {
      response.addCode(
        `await page.${await generateLocator(locator)}.screenshot(${formatObject(options)});`
      );
    } else {
      response.addCode(`await page.screenshot(${formatObject(options)});`);
    }
    const buffer = locator
      ? await locator.screenshot(options)
      : await tab.page.screenshot(options);
    response.addResult(
      `Took the ${screenshotTarget} screenshot and saved it as ${fileName}`
    );
    response.addImage({
      contentType: fileType === 'png' ? 'image/png' : 'image/jpeg',
      data: buffer,
    });
  },
});
export default [screenshot];
