import { zodToJsonSchema } from 'zod-to-json-schema';
import { z } from 'zod';

import { openai } from '@ai-sdk/openai';
import { generateText, tool } from 'ai';

import * as common from './common';
import { snapshotBatchSchema, CommonToolParams } from './schemas';
import * as snapshot from './snapshot';
import * as screenshot from './screenshot';
import { captureAriaSnapshot } from './utils';
import type { Tool } from './tool';

import dotenv from 'dotenv';

dotenv.config();

const systemMessage = `
    You are an Automation Test Engineer that is in charge of ensuring the quality of the software developed by 
    the Software Engineers. Your job is to execute end to end tests on the given web app and find 
    the bugs if there are any. At the end you need to report your findings back to the engineers in which
    if there are any bugs in your report, they will fix them. 

    You have access to a set of tools that will help you perform browser automation. Based on each test case, 
    you need to decide which tool is the best one to perform the next action. 

    Remeber the result of each test case execution and include the result of each specific test case in your report.

    Be deterministic in your response. The result of the test is either failed or pass. If the actual result does not 
    match the expect result, the test case is considered failed.
`;

const testCases = z.object({
  testDefinition: z.string().describe('The tesct case definition'),
  expect: z.string().optional().describe('The expected result of running the test case')
});

const endtoendSchema = z.object({
  testCases: z.array(testCases).describe('The list of test case definitions to execute on the web'),
  urls: z.array(z.string()).min(1).describe('One or more URLs to execute end-to-end tests against')
});

export const endtoend: Tool = {
  schema: {
    name: 'browser_endtoend',
    description: 'Run an end to end test suit in the browser',
    inputSchema: zodToJsonSchema(endtoendSchema)
  },

  handle: async (context, params) => {
    const validatedParams = endtoendSchema.parse(params);
    const content = `${systemMessage} - List of Urls in target for end to end testing : ${JSON.stringify(validatedParams)}`;
    const apiKey = context.apiKey;
    process.env.OPENAI_API_KEY = apiKey;
    while (true) {
      const result = generateText({
        model: openai('gpt-4o'),
        messages: [{ role: 'system', content: content }],
        tools: {
          // snapshot tools
          snapshot: tool({
            description: 'Capture accessibility snapshot of the current page, this is better than screenshot',
            parameters: z.object({}),
            execute: async () => {
              return await snapshot.snapshot.handle(context);
            }
          }),
          clickSnapshot: tool({
            description: 'Perform click on a web page',
            parameters: snapshot.elementSchema,
            execute: async (params: z.infer<typeof snapshot.elementSchema>) => {
              const validatedParams = snapshot.elementSchema.parse(params);
              return await snapshot.click.handle(context, validatedParams, true);
            }
          }),
          dragSnapshot: tool({
            description: 'Perform drag and drop between two elements',
            parameters: snapshot.dragSchema,
            execute: async (params: z.infer<typeof snapshot.dragSchema>) => {
              const validatedParams = snapshot.dragSchema.parse(params);
              return await snapshot.drag.handle(context, validatedParams, true);
            }
          }),
          hoverSnapshot: tool({
            description: 'Hover over element on page',
            parameters: snapshot.elementSchema,
            execute: async (params: z.infer<typeof snapshot.elementSchema>) => {
              const validatedParams = snapshot.elementSchema.parse(params);
              return await snapshot.hover.handle(context, validatedParams, true);
            }
          }),
          typeSnapshot: tool({
            description: 'Type text into editable element',
            parameters: snapshot.typeSchema,
            execute: async (params: z.infer<typeof snapshot.typeSchema>) => {
              const validatedParams = snapshot.typeSchema.parse(params);
              return await snapshot.type.handle(context, validatedParams, true);
            }
          }),
          selectOptionSnapshot: tool({
            description: 'Select an option in a dropdown',
            parameters: snapshot.selectOptionSchema,
            execute: async (params: z.infer<typeof snapshot.selectOptionSchema>) => {
              const validatedParams = snapshot.selectOptionSchema.parse(params);
              return await snapshot.selectOption.handle(context, validatedParams, true);
            }
          }),
          // screenshot tools
          screenshot: tool({
            description: 'Take a screenshot of the current page',
            parameters: z.object({}),
            execute: async () => {
              return await screenshot.screenshot.handle(context);
            }
          }),
          moveMouseVision: tool({
            description: 'Move mouse to a given position',
            parameters: screenshot.moveMouseSchema,
            execute: async (params: z.infer<typeof screenshot.moveMouseSchema>) => {
              const validatedParams = screenshot.moveMouseSchema.parse(params);
              return await screenshot.moveMouse.handle(context, validatedParams);
            }
          }),
          clickVision: tool({
            description: 'Click on a web page',
            parameters: screenshot.clickSchema,
            execute: async (params: z.infer<typeof screenshot.clickSchema>) => {
              const validatedParams = screenshot.clickSchema.parse(params);
              return await screenshot.click.handle(context, validatedParams);
            }
          }),
          dragVision: tool({
            description: 'Drag and drop between two elements',
            parameters: screenshot.dragSchema,
            execute: async (params: z.infer<typeof screenshot.dragSchema>) => {
              const validatedParams = screenshot.dragSchema.parse(params);
              return await screenshot.drag.handle(context, validatedParams);
            }
          }),
          typeVision: tool({
            description: 'Type text into editable element',
            parameters: screenshot.typeSchema,
            execute: async (params: z.infer<typeof screenshot.typeSchema>) => {
              const validatedParams = screenshot.typeSchema.parse(params);
              return await screenshot.type.handle(context, validatedParams);
            }
          }),
          // common tools
          navigate: tool({
            description: 'Navigate to a URL',
            parameters: common.navigateSchema,
            execute: async (params: z.infer<typeof common.navigateSchema>) => {
              const validatedParams = common.navigateSchema.parse(params);
              return await common.navigate(true).handle(context, validatedParams);
            }
          }),
          goBack: tool({
            description: 'Go back to the previous page',
            parameters: common.goBackSchema,
            execute: async (params: z.infer<typeof common.goBackSchema>) => {
              return await common.goBack(true).handle(context);
            }
          }),
          goForward: tool({
            description: 'Go back to the previous page',
            parameters: common.goForwardSchema,
            execute: async (params: z.infer<typeof common.goBackSchema>) => {
              return await common.goForward(true).handle(context);
            }
          }),
          wait: tool({
            description: 'Wait for a specified time in seconds',
            parameters: common.waitSchema,
            execute: async (params: z.infer<typeof common.waitSchema>) => {
              const validatedParams = common.waitSchema.parse(params);
              return await common.wait.handle(context, validatedParams, true);
            }
          }),
          pressKey: tool({
            description: 'Press a key on the keyboard',
            parameters: common.pressKeySchema,
            execute: async (params: z.infer<typeof common.pressKeySchema>) => {
              const validatedParams = common.pressKeySchema.parse(params);
              return await common.pressKey.handle(context, validatedParams, true);
            }
          }),
          pdf: tool({
            description: 'Save page as PDF',
            parameters: common.pdfSchema,
            execute: async (params: z.infer<typeof common.pdfSchema>) => {
              const validatedParams = common.pdfSchema.parse(params);
              return await common.pdf.handle(context, validatedParams, true);
            }
          }),
          close: tool({
            description: 'Close the page',
            parameters: common.closeSchema,
            execute: async (params: z.infer<typeof common.closeSchema>) => {
              const validatedParams = common.closeSchema.parse(params);
              return await common.close.handle(context, validatedParams, true);
            }
          }),
          chooseFile: tool({
            description: 'Choose one or multiple files to upload',
            parameters: common.chooseFileSchema,
            execute: async (params: z.infer<typeof common.chooseFileSchema>) => {
              const validatedParams = common.chooseFileSchema.parse(params);
              return await common.chooseFile(true).handle(context, validatedParams);
            }
          })
        },
        maxSteps: 5
      });
      let fullResponse = '';
      for await (const delta of (await result).text)
        fullResponse += delta;

      return {
        content: [{ type: 'text', text: fullResponse }]
      };
    }
  }
};
