/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/* eslint-disable no-console */

import OpenAI from 'openai';
import dotenv from 'dotenv';
import debug from 'debug';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

import { packageJSON, resolveFromRoot } from '../package.js';

import type { Tool } from '@modelcontextprotocol/sdk/types.js';

dotenv.config();

const doneTool: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'done',
    description: 'Call this tool to indicate that the task is complete.',
    parameters: {},
  },
};

async function connectToMCP(): Promise<{ client: Client, tools: Tool[] }> {
  const transport = new StdioClientTransport({
    command: 'node',
    args: [resolveFromRoot('cli.js')],
    env: process.env as Record<string, string>,
  });

  const client = new Client({ name: packageJSON.name, version: packageJSON.version });
  await client.connect(transport);
  await client.ping();

  const { tools } = await client.listTools();
  return { client, tools };
}

function asOpenAITool(tool: Tool): OpenAI.Chat.Completions.ChatCompletionTool {
  const parameters = { ...tool.inputSchema };
  delete parameters.$schema;
  return {
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters
    },
  };
}

async function performSteps(steps: string[]) {
  const { client, tools } = await connectToMCP();
  const openAITools = [doneTool, ...tools.map(asOpenAITool)];
  const openai = new OpenAI();

  for (const step of steps)
    await performStep(step, client, openai, openAITools);

  await client.close();
}

async function performStep(step: string, client: Client, openai: OpenAI, tools: OpenAI.Chat.Completions.ChatCompletionTool[]) {
  console.log('Perform step:', step);
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    {
      role: 'user',
      content: `Peform following action: ${step}. Once the action is complete, call the "done" tool.`
    }
  ];

  for (let iteration = 0; iteration < 5; ++iteration) {
    debug('history')(messages);
    const response = await openai.chat.completions.create({
      model: 'gpt-4.1',
      messages,
      tools,
      tool_choice: 'auto'
    });

    const message = response.choices[0].message;
    if (!message.tool_calls?.length)
      throw new Error('Unexpected response from LLM: ' + message.content);

    messages.push({
      role: 'assistant',
      tool_calls: message.tool_calls
    });

    for (const toolCall of message.tool_calls) {
      const functionCall = toolCall.function;
      console.log('Call tool:', functionCall.name, functionCall.arguments);

      if (functionCall.name === 'done')
        return;

      const result = await client.callTool({
        name: functionCall.name,
        arguments: JSON.parse(functionCall.arguments)
      });
      messages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: (result.content as any)[0].text,
      });
    }
  }
  throw new Error('Failed to perform step, max attempts reached');
}

const script = [
  'Navigate to https://debs-obrien.github.io/playwright-movies-app',
  'Click search icon',
  'Type "Twister" in the search field and hit Enter',
  'Click on the link for the movie "Twisters"',
];

void performSteps(script);
