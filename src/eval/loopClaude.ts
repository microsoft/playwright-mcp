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

import Anthropic from '@anthropic-ai/sdk';
import debug from 'debug';

import type { Tool, ImageContent, TextContent } from '@modelcontextprotocol/sdk/types.js';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';

const model = 'claude-sonnet-4-20250514';

export async function runTask(client: Client, task: string): Promise<string | undefined> {
  const anthropic = new Anthropic();
  const messages: Anthropic.Messages.MessageParam[] = [];

  const { tools } = await client.listTools();
  const claudeTools = tools.map(tool => asClaudeDeclaration(tool));

  // Add initial user message
  messages.push({
    role: 'user',
    content: `Perform following task: ${task}.`
  });

  for (let iteration = 0; iteration < 5; ++iteration) {
    debug('history')(messages);

    const response = await anthropic.messages.create({
      model,
      max_tokens: 10000,
      messages,
      tools: claudeTools,
    });

    const content = response.content;

    const toolUseBlocks = content.filter(block => block.type === 'tool_use');
    const textBlocks = content.filter(block => block.type === 'text');

    messages.push({
      role: 'assistant',
      content: content
    });

    if (toolUseBlocks.length === 0)
      return textBlocks.map(block => block.text).join('\n');

    const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];

    for (const toolUse of toolUseBlocks) {
      if (toolUse.name === 'done')
        return JSON.stringify(toolUse.input, null, 2);

      try {
        debug('tool')(toolUse.name, toolUse.input);
        const response = await client.callTool({
          name: toolUse.name,
          arguments: toolUse.input as any,
        });
        const responseContent = (response.content || []) as (TextContent | ImageContent)[];
        debug('tool')(responseContent);
        const text = responseContent.filter(part => part.type === 'text').map(part => part.text).join('\n');

        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: text,
        });
      } catch (error) {
        debug('tool')(error);
        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: `Error while executing tool "${toolUse.name}": ${error instanceof Error ? error.message : String(error)}\n\nPlease try to recover and complete the task.`,
          is_error: true,
        });
        // Skip remaining tool calls for this iteration
        for (const remainingToolUse of toolUseBlocks.slice(toolUseBlocks.indexOf(toolUse) + 1)) {
          toolResults.push({
            type: 'tool_result',
            tool_use_id: remainingToolUse.id,
            content: `This tool call is skipped due to previous error.`,
            is_error: true,
          });
        }
        break;
      }
    }

    // Add tool results as user message
    messages.push({
      role: 'user',
      content: toolResults
    });
  }

  throw new Error('Failed to perform step, max attempts reached');
}

function asClaudeDeclaration(tool: Tool): Anthropic.Messages.Tool {
  return {
    name: tool.name,
    description: tool.description,
    input_schema: tool.inputSchema,
  };
}
