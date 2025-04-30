import { zodToJsonSchema } from 'zod-to-json-schema';
import { z } from 'zod';
import axios from 'axios';

import * as common from '@limetest/core';
import * as snapshot from '@limetest/core';
import * as screenshot from '@limetest/core';
import type { Tool as CoreTool } from '@limetest/core';

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

  IMPORTANT: After completing all test steps, you MUST provide your final response in the following JSON format ONLY:
  {
    "status": "PASS" or "FAIL",
    "errorMessage": "Error message explaining why the test failed (only include if status is FAIL)"
  }

  Remember that the result of each test case execution is either PASS or FAIL. If the actual result does not 
  match the expected result, the test case is considered FAILED.

  You MUST Provide a JSON object as a response. If you are not sure about the result of the test case, return FAIL, but you must return a JSON object.
`;

const testCase = z.object({
  testDefinition: z.string().describe('The test case definition'),
});

// Type definitions for OpenRouter API
type Message = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
  name?: string;
};

type ToolCall = {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
};

type LLMTool = {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: any;
  };
};

type OpenRouterRequest = {
  model: string;
  messages: Message[];
  tools?: LLMTool[];
  tool_choice?: 'auto' | 'none' | any;
  stream?: boolean;
  max_tokens?: number;
};

type OpenRouterResponse = {
  id: string;
  choices: {
    message: {
      content: string | null;
      role: string;
      tool_calls?: ToolCall[];
    };
    finish_reason: string | null;
  }[];
};

// Helper function to convert Zod schema to OpenRouter function parameters format
function zodSchemaToFunctionParams(schema: z.ZodType<any>) {
  try {
    const jsonSchema = zodToJsonSchema(schema);
    return jsonSchema;
  } catch (error) {
    console.error('Error converting schema:', error);
    return { type: 'object', properties: {} };
  }
}

// Define all tools for OpenRouter format
const tools: LLMTool[] = [
  // Snapshot tools
  {
    type: 'function',
    function: {
      name: 'snapshot',
      description: 'Capture accessibility snapshot of the current page, this is better than screenshot',
      parameters: { type: 'object', properties: {} },
    }
  },
  {
    type: 'function',
    function: {
      name: 'clickSnapshot',
      description: 'Perform click on a web page',
      parameters: zodSchemaToFunctionParams(snapshot.elementSchema),
    }
  },
  {
    type: 'function',
    function: {
      name: 'dragSnapshot',
      description: 'Perform drag and drop between two elements',
      parameters: zodSchemaToFunctionParams(snapshot.dragSchema),
    }
  },
  {
    type: 'function',
    function: {
      name: 'hoverSnapshot',
      description: 'Hover over element on page',
      parameters: zodSchemaToFunctionParams(snapshot.elementSchema),
    }
  },
  {
    type: 'function',
    function: {
      name: 'typeSnapshot',
      description: 'Type text into editable element',
      parameters: zodSchemaToFunctionParams(snapshot.typeSchema),
    }
  },
  {
    type: 'function',
    function: {
      name: 'selectOptionSnapshot',
      description: 'Select an option in a dropdown',
      parameters: zodSchemaToFunctionParams(snapshot.selectOptionSchema),
    }
  },
  // Screenshot tools
  {
    type: 'function',
    function: {
      name: 'screenshot',
      description: 'Take a screenshot of the current page',
      parameters: { type: 'object', properties: {} },
    }
  },
  {
    type: 'function',
    function: {
      name: 'moveMouseVision',
      description: 'Move mouse to a given position',
      parameters: zodSchemaToFunctionParams(screenshot.moveMouseSchema),
    }
  },
  {
    type: 'function',
    function: {
      name: 'clickVision',
      description: 'Click on a web page',
      parameters: zodSchemaToFunctionParams(screenshot.clickVisionkSchema),
    }
  },
  {
    type: 'function',
    function: {
      name: 'dragVision',
      description: 'Drag and drop between two elements',
      parameters: zodSchemaToFunctionParams(screenshot.dragVisionkSchema),
    }
  },
  {
    type: 'function',
    function: {
      name: 'typeVision',
      description: 'Type text into editable element',
      parameters: zodSchemaToFunctionParams(screenshot.typeVisionkSchema),
    }
  },
  // Common tools
  {
    type: 'function',
    function: {
      name: 'navigate',
      description: 'Navigate to a URL',
      parameters: zodSchemaToFunctionParams(common.navigateSchema),
    }
  },
  {
    type: 'function',
    function: {
      name: 'goBack',
      description: 'Go back to the previous page',
      parameters: { type: 'object', properties: {} },
    }
  },
  {
    type: 'function',
    function: {
      name: 'goForward',
      description: 'Go back to the previous page',
      parameters: { type: 'object', properties: {} },
    }
  },
  {
    type: 'function',
    function: {
      name: 'wait',
      description: 'Wait for a specified time in seconds',
      parameters: zodSchemaToFunctionParams(common.waitSchema),
    }
  },
  {
    type: 'function',
    function: {
      name: 'pressKey',
      description: 'Press a key on the keyboard',
      parameters: zodSchemaToFunctionParams(common.pressKeySchema),
    }
  },
  {
    type: 'function',
    function: {
      name: 'pdf',
      description: 'Save page as PDF',
      parameters: zodSchemaToFunctionParams(common.pdfSchema),
    }
  },
  {
    type: 'function',
    function: {
      name: 'close',
      description: 'Close the page',
      parameters: zodSchemaToFunctionParams(common.closeSchema),
    }
  },
  {
    type: 'function',
    function: {
      name: 'chooseFile',
      description: 'Choose one or multiple files to upload',
      parameters: zodSchemaToFunctionParams(common.chooseFileSchema),
    }
  }
];

// Function to handle the tool execution based on function call
async function handleToolExecution(context: any, toolName: string, toolParams: any) {
  switch (toolName) {
    // Snapshot tools
    case 'snapshot':
      return await snapshot.snapshot.handle(context);
    case 'clickSnapshot':
      return await snapshot.click.handle(context, snapshot.elementSchema.parse(toolParams), true);
    case 'dragSnapshot':
      return await snapshot.drag.handle(context, snapshot.dragSchema.parse(toolParams), true);
    case 'hoverSnapshot':
      return await snapshot.hover.handle(context, snapshot.elementSchema.parse(toolParams), true);
    case 'typeSnapshot':
      return await snapshot.type.handle(context, snapshot.typeSchema.parse(toolParams), true);
    case 'selectOptionSnapshot':
      return await snapshot.selectOption.handle(context, snapshot.selectOptionSchema.parse(toolParams), true);

    // Screenshot tools
    case 'screenshot':
      return await screenshot.screenshot.handle(context);
    case 'moveMouseVision':
      return await screenshot.moveMouse.handle(context, screenshot.moveMouseSchema.parse(toolParams));
    case 'clickVision':
      return await screenshot.clickVision.handle(context, screenshot.clickVisionkSchema.parse(toolParams));
    case 'dragVision':
      return await screenshot.dragVision.handle(context, screenshot.dragVisionkSchema.parse(toolParams));
    case 'typeVision':
      return await screenshot.typeVision.handle(context, screenshot.typeVisionkSchema.parse(toolParams));

    // Common tools
    case 'navigate':
      return await common.navigate(true).handle(context, common.navigateSchema.parse(toolParams));
    case 'goBack':
      return await common.goBack(true).handle(context);
    case 'goForward':
      return await common.goForward(true).handle(context);
    case 'wait':
      return await common.wait.handle(context, common.waitSchema.parse(toolParams), true);
    case 'pressKey':
      return await common.pressKey.handle(context, common.pressKeySchema.parse(toolParams), true);
    case 'pdf':
      return await common.pdf.handle(context, common.pdfSchema.parse(toolParams), true);
    case 'close':
      return await common.close.handle(context, common.closeSchema.parse(toolParams), true);
    case 'chooseFile':
      return await common.chooseFile(true).handle(context, common.chooseFileSchema.parse(toolParams));
    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}

// Our Core Tool implementation that interfaces with the @best/core module
export const endtoend: CoreTool = {
  schema: {
    name: 'browser_endtoend',
    description: 'Run an end to end test suit in the browser',
    inputSchema: zodToJsonSchema(testCase)
  },

  handle: async (context: any, params: any) => {
    const validatedParams = testCase.parse(params);
    const content = `${systemMessage} - List of Urls in target for end to end testing : ${JSON.stringify(validatedParams)}`;

    // Get API key from context or environment
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey)
      throw new Error('API key is required');


    const currentMessages: Message[] = [
      { role: 'system', content }
    ];

    // Maximum number of tool call steps
    const maxSteps = 5;
    let currentStep = 0;

    while (currentStep < maxSteps) {
      currentStep++;

      try {
        // Call OpenRouter API directly using axios
        const response = await axios.post('https://openrouter.ai/api/v1/chat/completions',
          {
            model: 'openai/gpt-4o', // Can be changed to any supported model
            messages: currentMessages,
            tools: tools,
            tool_choice: 'auto'
          } as OpenRouterRequest,
          {
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
              'HTTP-Referer': 'https://playwright-mcp.dev', // Optional for rankings
              'X-Title': 'Playwright MCP Tests', // Optional for rankings
            }
          }
        );

        const data = response.data as OpenRouterResponse;
        const message = data.choices[0].message;

        // Add the assistant's message to our conversation
        currentMessages.push({
          role: 'assistant',
          content: message.content,
          tool_calls: message.tool_calls
        });

        // If there are tool calls in the response
        if (message.tool_calls && message.tool_calls.length > 0) {
          for (const toolCall of message.tool_calls) {
            const functionName = toolCall.function.name;
            const functionParams = JSON.parse(toolCall.function.arguments);

            // Execute the tool
            const toolResult = await handleToolExecution(context, functionName, functionParams);

            // Add the tool response to messages
            currentMessages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: JSON.stringify(toolResult)
            });
          }
        } else {
          // No more tool calls, we can return the final response
          return {
            content: [{ type: 'text', text: message.content || '' }]
          };
        }
      } catch (error: any) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ status: 'FAIL', errorMessage: `Error during execution: ${error.message}` }) }]
        };
      }
    }

    // If we've reached the maximum number of steps, return the last assistant message
    const lastAssistantMessage = currentMessages.filter(m => m.role === 'assistant').pop();
    return {
      content: [{ type: 'text', text: lastAssistantMessage?.content || JSON.stringify({ status: 'FAIL', errorMessage: 'Reached maximum number of steps without result' }) }]
    };
  }
};
