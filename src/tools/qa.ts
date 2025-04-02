import { zodToJsonSchema } from 'zod-to-json-schema';
import { z } from 'zod';

import { openai } from '@ai-sdk/openai';
import { generateText, tool } from 'ai';

import * as common from './common';
import { snapshotBatchSchema, CommonToolParams } from './schemas';
import * as snapshot from './snapshot';
import { captureAriaSnapshot } from './utils';
import type { Tool } from './tool';

import dotenv from 'dotenv';

dotenv.config();

const systemMessage = `
    You are an Automation Test Engineer that is in charge of ensuring the quality of the software developed by 
    the Software Engineers. Your job is to execute end to end tests on the given web app and find 
    the bugs if there are any. At the end you need to report your findings back to the engineers in which
    if there are any busg in your report, they will fix them. 

    You are given two tools. Snapshot and Batch:
    
    Snapshot: "For any given url, generate snapshots of the web page."
    Batch: "Run browser automation tools in order, given a list of tools that are available for use"
    
    The batch tool runs browser automation given a test case with steps to run using playwright. 
    Batch tool works with "Aria Refs". In order to use the correct refs for batch tool, you need to use 
    Snapshot tool first. With Snapshot tool you can generate the snapshot for each url or page and recieve the 
    refs for the elements on that page. Using the refs, you can properly call the batch tools to perform browser automation. 
    It is very important to know the refs before calling batch tool in order to prevent reporting a bug where it was just a mismatch between 
    refs. Therefore, be sure to always call the snapshot tool once before calling the batch tool.
`;

export const qa: Tool = {
  schema: {
    name: "browser_qa",
    description: "Run an end to end test suit in the browser",
    inputSchema: zodToJsonSchema(common.multiNavigationSchema)
   },

  handle: async (context, params) => { 
    const validatedParams = common.multiNavigationSchema.parse(params);
    const content = `${systemMessage} - List of Urls in target for end to end testing : ${JSON.stringify(validatedParams)}`
    const result = generateText({
        model: openai('gpt-4o'),
        messages: [{ role: 'system', content: content }],
        tools: {
        snapshot: tool({
            description: 'Provided urls, get the snapshot of the pages that need validation',
            parameters: common.multiNavigationSchema,
            execute: async (params: z.infer<typeof common.multiNavigationSchema>) => {
                return await common.multiNavigation(true).handle(context, params);
            }
        }),
        batch: tool ({
            description: 'Provided snapshots, run end to end automation tests in the browser',
            parameters: batchSchema,
            execute: async (params: z.infer<typeof batchSchema>) => {
                return await batch.handle(context, params);
            }
         })
        },
        maxSteps: 5,
        onStepFinish: step => {
          console.log(JSON.stringify(step, null, 2));
        },
    });
    let fullResponse = '';
    for await (const delta of (await result).text) {
        fullResponse += delta;
    }
    return {
        content: [{ type: 'text', text: fullResponse}]
    }
  }
}

// Define snapshot-specific tool params
export const snapshotParams = z.discriminatedUnion('name', [
    z.object({
      name: z.literal('browser_drag'),
      params: snapshot.dragSchema
    }),
    z.object({
      name: z.literal('browser_click'),
      params: snapshot.elementSchema
    }),
    z.object({
      name: z.literal('browser_hover'),
      params: snapshot.elementSchema
    }),
    z.object({
      name: z.literal('browser_type'),
      params: snapshot.typeSchema
    }),
    z.object({
      name: z.literal('browser_select_option'),
      params: snapshot.selectOptionSchema
    }),
  ]);
  
// Combine with common tools
const SnapshotStepSchema = z.union([CommonToolParams, snapshotParams]);

const batchSchema = snapshotBatchSchema.extend({
  input: z.object({
    test_cases: z.array(z.object({
      definition: z.string(),
      steps: z.array(SnapshotStepSchema)
    }))
  })
});

const batch: Tool = {
  schema: {
    name: 'browser_batch',
    description: 'TOOL CALL REQUIREMENT: MUST CALL browser_navigate TOOL FIRST IN THE TARGET URLS BEFORE CALLING THIS TOOL TO GET THE CORRECT ARIA REFS. This tool runs a bunch of steps at once.',
    inputSchema: zodToJsonSchema(batchSchema)
  },
  handle: async (context, params) => {
    const validatedParams = batchSchema.parse(params);
    const results = [];

    for (const testCase of validatedParams.input.test_cases) {
      for (const step of testCase.steps as Array<{ name: string; params: any }>) {
        let tool: Tool;
        switch (step.name) {
          case 'browser_drag': 
            tool = snapshot.drag;
            break;
          case 'browser_click':
            tool = snapshot.click;
            break;
          case 'browser_hover':
            tool = snapshot.hover;
            break;
          case 'browser_type':
            tool = snapshot.type;
            break;
          case 'browser_select_option':
            tool = snapshot.selectOption;
            break;
          case 'browser_press_key':
            tool = common.pressKey;
            break;
          case 'browser_wait':
            tool = common.wait;
            break;
          case 'browser_save_as_pdf':
            tool = common.pdf;
            break;
          case 'browser_close':
            tool = common.close;
            break;
          case 'browser_navigate':
            tool = common.navigate(false);
            break;
          case 'browser_go_back':
            tool = common.goBack(false);
            break;
          case 'browser_go_forward':
            tool = common.goForward(false);
            break;
          case 'browser_choose_file': 
            tool = common.chooseFile(false);
            break;
          default:
            throw new Error(`Unknown tool for snapshot mode: ${step.name}`);
        }

        try {
          let result = await tool.handle(context, step.params, false);
          result = {
            content: [...result.content, ...(await captureAriaSnapshot(context)).content],
            isError: result.isError
          };
          results.push({ definition: testCase.definition, step: step.name, result });
        } catch (error) {
          return {
            content: [{ 
              type: 'text', 
              text: `Failed to execute snapshot step "${step.name}": ${error}. Here is the batch tool result: \n${JSON.stringify(results, null, 2)}` 
            }],
            isError: true
          };
        }
      }
    }

    return {
      content: [{ 
        type: 'text', 
        text: `Successfully executed snapshot steps:\n${JSON.stringify(results, null, 2)}` 
      }]
    };
  }
};
