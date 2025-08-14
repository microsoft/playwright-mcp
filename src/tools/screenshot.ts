import type * as playwright from 'playwright';
import { z } from 'zod';
import { formatObject } from '../javascript.js';
import type { Response } from '../response.js';
import { expectationSchema } from '../schemas/expectation.js';
import type { Tab } from '../tab.js';
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
        'Element reference ID from browser_snapshot or browser_find_elements results (e.g., "rNODE-45-1"). DO NOT create custom ref values - they must be obtained from previous tool outputs. If not provided, the screenshot will be taken of viewport. If ref is provided, element must be provided too.'
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

type ScreenshotParams = z.output<typeof screenshotSchema>;

async function prepareFileName(
  context: Tab['context'],
  filename: string | undefined,
  fileType: string
): Promise<string> {
  const defaultName = `page-${new Date().toISOString()}.${fileType}`;
  return await context.outputFile(filename ?? defaultName);
}

function createScreenshotOptions(
  fileType: string,
  fileName: string,
  fullPage?: boolean
): playwright.PageScreenshotOptions {
  return {
    type: fileType as 'png' | 'jpeg',
    quality: fileType === 'png' ? undefined : 90,
    scale: 'css',
    path: fileName,
    ...(fullPage !== undefined && { fullPage }),
  };
}

function isElementScreenshotRequest(params: ScreenshotParams): boolean {
  return !!(params.element && params.ref);
}

function getScreenshotTarget(
  params: ScreenshotParams,
  isElementScreenshot: boolean
): string {
  if (isElementScreenshot && params.element) {
    return params.element;
  }
  return params.fullPage ? 'full page' : 'viewport';
}

async function getScreenshotLocator(
  tab: Tab,
  params: ScreenshotParams,
  isElementScreenshot: boolean
): Promise<playwright.Locator | null> {
  if (!(isElementScreenshot && params.element && params.ref)) {
    return null;
  }
  return await tab.refLocator({ element: params.element, ref: params.ref });
}

async function addScreenshotCode(
  response: Response,
  locator: playwright.Locator | null,
  options: playwright.PageScreenshotOptions
): Promise<void> {
  if (locator) {
    response.addCode(
      `await page.${await generateLocator(locator)}.screenshot(${formatObject(options)});`
    );
  } else {
    response.addCode(`await page.screenshot(${formatObject(options)});`);
  }
}

async function takeScreenshot(
  tab: Tab,
  locator: playwright.Locator | null,
  options: playwright.PageScreenshotOptions
): Promise<Buffer> {
  return locator
    ? await locator.screenshot(options)
    : await tab.page.screenshot(options);
}

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
    const fileName = await prepareFileName(
      tab.context,
      params.filename,
      fileType
    );
    const options = createScreenshotOptions(
      fileType,
      fileName,
      params.fullPage
    );

    const isElementScreenshot = isElementScreenshotRequest(params);
    const screenshotTarget = getScreenshotTarget(params, isElementScreenshot);

    response.addCode(
      `// Screenshot ${screenshotTarget} and save it as ${fileName}`
    );

    const locator = await getScreenshotLocator(
      tab,
      params,
      isElementScreenshot
    );
    await addScreenshotCode(response, locator, options);

    const buffer = await takeScreenshot(tab, locator, options);

    response.addResult(
      `Took the ${screenshotTarget} screenshot and saved it as ${fileName}`
    );

    // https://github.com/microsoft/playwright-mcp/issues/817
    // Never return large images to LLM, saving them to the file system is enough.
    if (!params.fullPage) {
      response.addImage({
        contentType: fileType === 'png' ? 'image/png' : 'image/jpeg',
        data: buffer,
      });
    }
  },
});
export default [screenshot];
