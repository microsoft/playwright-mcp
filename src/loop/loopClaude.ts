import type Anthropic from '@anthropic-ai/sdk';
import type { LLMDelegate, LLMConversation, LLMToolCall, LLMTool } from './loop.js';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
const model = 'claude-sonnet-4-20250514';
export class ClaudeDelegate implements LLMDelegate {
  private _anthropic: Anthropic | undefined;
  async anthropic(): Promise<Anthropic> {
    if (!this._anthropic) {
      const anthropic = await import('@anthropic-ai/sdk');
      this._anthropic = new anthropic.Anthropic();
    }
    return this._anthropic;
  }
  createConversation(task: string, tools: Tool[], oneShot: boolean): LLMConversation {
    const llmTools: LLMTool[] = tools.map(tool => ({
      name: tool.name,
      description: tool.description || '',
      inputSchema: tool.inputSchema,
    }));
    if (!oneShot) {
      llmTools.push({
        name: 'done',
        description: 'Call this tool when the task is complete.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      });
    }
    return {
      messages: [{
        role: 'user',
        content: task
      }],
      tools: llmTools,
    };
  }
  async makeApiCall(conversation: LLMConversation): Promise<LLMToolCall[]> {
    // Convert generic messages to Claude format
    const claudeMessages: Anthropic.Messages.MessageParam[] = [];
    for (const message of conversation.messages) {
      if (message.role === 'user') {
        claudeMessages.push({
          role: 'user',
          content: message.content
        });
      } else if (message.role === 'assistant') {
        const content: Anthropic.Messages.ContentBlock[] = [];
        // Add text content
        if (message.content) {
          content.push({
            type: 'text',
            text: message.content,
            citations: []
          });
        }
        // Add tool calls
        if (message.toolCalls) {
          for (const toolCall of message.toolCalls) {
            content.push({
              type: 'tool_use',
              id: toolCall.id,
              name: toolCall.name,
              input: toolCall.arguments
            });
          }
        }
        claudeMessages.push({
          role: 'assistant',
          content
        });
      } else if (message.role === 'tool') {
        // Tool results are added differently - we need to find if there's already a user message with tool results
        const lastMessage = claudeMessages[claudeMessages.length - 1];
        const toolResult: Anthropic.Messages.ToolResultBlockParam = {
          type: 'tool_result',
          tool_use_id: message.toolCallId,
          content: message.content,
          is_error: message.isError,
        };
        if (lastMessage && lastMessage.role === 'user' && Array.isArray(lastMessage.content)) {
          // Add to existing tool results message
          (lastMessage.content as Anthropic.Messages.ToolResultBlockParam[]).push(toolResult);
        } else {
          // Create new tool results message
          claudeMessages.push({
            role: 'user',
            content: [toolResult]
          });
        }
      }
    }
    // Convert generic tools to Claude format
    const claudeTools: Anthropic.Messages.Tool[] = conversation.tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.inputSchema,
    }));
    const anthropic = await this.anthropic();
    const response = await anthropic.messages.create({
      model,
      max_tokens: 10000,
      messages: claudeMessages,
      tools: claudeTools,
    });
    // Extract tool calls and add assistant message to generic conversation
    const toolCalls = response.content.filter(block => block.type === 'tool_use') as Anthropic.Messages.ToolUseBlock[];
    const textContent = response.content.filter(block => block.type === 'text').map(block => (block as Anthropic.Messages.TextBlock).text).join('');
    const llmToolCalls: LLMToolCall[] = toolCalls.map(toolCall => ({
      name: toolCall.name,
      arguments: toolCall.input as any,
      id: toolCall.id,
    }));
    // Add assistant message to generic conversation
    conversation.messages.push({
      role: 'assistant',
      content: textContent,
      toolCalls: llmToolCalls.length > 0 ? llmToolCalls : undefined
    });
    return llmToolCalls;
  }
  addToolResults(
    conversation: LLMConversation,
    results: Array<{ toolCallId: string; content: string; isError?: boolean }>
  ): void {
    for (const result of results) {
      conversation.messages.push({
        role: 'tool',
        toolCallId: result.toolCallId,
        content: result.content,
        isError: result.isError,
      });
    }
  }
  checkDoneToolCall(toolCall: LLMToolCall): string | null {
    if (toolCall.name === 'done')
      return (toolCall.arguments as { result: string }).result;
    return null;
  }
}
