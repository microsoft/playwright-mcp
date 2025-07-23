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

import OpenAI from 'openai';
import debug from 'debug';

import type { Tool, ImageContent, TextContent } from '@modelcontextprotocol/sdk/types.js';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';

const model = 'gpt-4.1';

export async function runTask(client: Client, task: string): Promise<string | undefined> {
  const openai = new OpenAI();
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    {
      role: 'user',
      content: `Peform following task: ${task}. Once the task is complete, call the "done" tool.`
    }
  ];

  const { tools } = await client.listTools();

  for (let iteration = 0; iteration < 5; ++iteration) {
    debug('history')(messages);

    const response = await openai.chat.completions.create({
      model,
      messages,
      tools: tools.map(tool => asOpenAIDeclaration(tool)),
      tool_choice: 'auto'
    });

    const message = response.choices[0].message;
    if (!message.tool_calls?.length)
      return JSON.stringify(message.content, null, 2);

    messages.push({
      role: 'assistant',
      tool_calls: message.tool_calls
    });

    for (const toolCall of message.tool_calls) {
      const functionCall = toolCall.function;

      if (functionCall.name === 'done')
        return JSON.stringify(functionCall.arguments, null, 2);

      try {
        debug('tool')(functionCall.name, functionCall.arguments);
        const response = await client.callTool({
          name: functionCall.name,
          arguments: JSON.parse(functionCall.arguments)
        });
        const content = (response.content || []) as (TextContent | ImageContent)[];
        debug('tool')(content);
        const text = content.filter(part => part.type === 'text').map(part => part.text).join('\n');
        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: text,
        });
      } catch (error) {
        debug('tool')(error);
        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: `Error while executing tool "${functionCall.name}": ${error instanceof Error ? error.message : String(error)}\n\nPlease try to recover and complete the task.`,
        });
        for (const ignoredToolCall of message.tool_calls.slice(message.tool_calls.indexOf(toolCall) + 1)) {
          messages.push({
            role: 'tool',
            tool_call_id: ignoredToolCall.id,
            content: `This tool call is skipped due to previous error.`,
          });
        }
        break;
      }
    }
  }
  throw new Error('Failed to perform step, max attempts reached');
}

function asOpenAIDeclaration(tool: Tool): OpenAI.Chat.Completions.ChatCompletionTool {
  return {
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema,
    },
  };
}
