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

import debug from 'debug';
import type { Tool, ImageContent, TextContent } from '@modelcontextprotocol/sdk/types.js';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';

export type LLMToolCall = {
  name: string;
  arguments: any;
  id: string;
};

export type LLMTool = {
  name: string;
  description: string;
  inputSchema: any;
};

export type LLMMessage =
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string; toolCalls?: LLMToolCall[] }
  | { role: 'tool'; toolCallId: string; content: string; isError?: boolean };

export type LLMConversation = {
  messages: LLMMessage[];
  tools: LLMTool[];
};

export interface LLMDelegate {
  createConversation(task: string, tools: Tool[], oneShot: boolean): LLMConversation;
  makeApiCall(conversation: LLMConversation): Promise<LLMToolCall[]>;
  addToolResults(conversation: LLMConversation, results: Array<{ toolCallId: string; content: string; isError?: boolean }>): void;
  checkDoneToolCall(toolCall: LLMToolCall): string | null;
}

export async function runTask(delegate: LLMDelegate, client: Client, task: string, oneShot: boolean = false): Promise<LLMMessage[]> {
  const { tools } = await client.listTools();
  const taskContent = oneShot ? `Perform following task: ${task}.` : `Perform following task: ${task}. Once the task is complete, call the "done" tool.`;
  const conversation = delegate.createConversation(taskContent, tools, oneShot);

  for (let iteration = 0; iteration < 5; ++iteration) {
    debug('history')('Making API call for iteration', iteration);
    const toolCalls = await delegate.makeApiCall(conversation);
    if (toolCalls.length === 0)
      throw new Error('Call the "done" tool when the task is complete.');

    const toolResults: Array<{ toolCallId: string; content: string; isError?: boolean }> = [];
    for (const toolCall of toolCalls) {
      const doneResult = delegate.checkDoneToolCall(toolCall);
      if (doneResult !== null)
        return conversation.messages;

      const { name, arguments: args, id } = toolCall;
      try {
        debug('tool')(name, args);
        const response = await client.callTool({
          name,
          arguments: args,
        });
        const responseContent = (response.content || []) as (TextContent | ImageContent)[];
        debug('tool')(responseContent);
        const text = responseContent.filter(part => part.type === 'text').map(part => part.text).join('\n');

        toolResults.push({
          toolCallId: id,
          content: text,
        });
      } catch (error) {
        debug('tool')(error);
        toolResults.push({
          toolCallId: id,
          content: `Error while executing tool "${name}": ${error instanceof Error ? error.message : String(error)}\n\nPlease try to recover and complete the task.`,
          isError: true,
        });

        // Skip remaining tool calls for this iteration
        for (const remainingToolCall of toolCalls.slice(toolCalls.indexOf(toolCall) + 1)) {
          toolResults.push({
            toolCallId: remainingToolCall.id,
            content: `This tool call is skipped due to previous error.`,
            isError: true,
          });
        }
        break;
      }
    }

    delegate.addToolResults(conversation, toolResults);
    if (oneShot)
      return conversation.messages;
  }

  throw new Error('Failed to perform step, max attempts reached');
}
