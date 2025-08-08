import type Anthropic from '@anthropic-ai/sdk';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type {
  LLMConversation,
  LLMDelegate,
  LLMMessage,
  LLMTool,
  LLMToolCall,
} from './loop.js';

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
  createConversation(
    task: string,
    tools: Tool[],
    oneShot: boolean
  ): LLMConversation {
    const llmTools: LLMTool[] = tools.map((tool) => ({
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
      messages: [
        {
          role: 'user',
          content: task,
        },
      ],
      tools: llmTools,
    };
  }
  async makeApiCall(conversation: LLMConversation): Promise<LLMToolCall[]> {
    const claudeMessages = this.convertMessagesToClaudeFormat(
      conversation.messages
    );
    const claudeTools = this.convertToolsToClaudeFormat(conversation.tools);

    const response = await this.callClaudeApi(claudeMessages, claudeTools);
    const llmToolCalls = this.extractToolCallsFromResponse(response);

    this.addAssistantMessageToConversation(
      conversation,
      response,
      llmToolCalls
    );
    return llmToolCalls;
  }

  private convertMessagesToClaudeFormat(
    messages: LLMConversation['messages']
  ): Anthropic.Messages.MessageParam[] {
    const claudeMessages: Anthropic.Messages.MessageParam[] = [];
    for (const message of messages) {
      if (message.role === 'user') {
        this.addUserMessage(claudeMessages, message);
      } else if (message.role === 'assistant') {
        this.addAssistantMessage(claudeMessages, message);
      } else if (message.role === 'tool') {
        this.addToolResultMessage(claudeMessages, message);
      }
    }
    return claudeMessages;
  }

  private addUserMessage(
    claudeMessages: Anthropic.Messages.MessageParam[],
    message: LLMMessage
  ): void {
    if (message.role === 'user') {
      claudeMessages.push({
        role: 'user',
        content: message.content,
      });
    }
  }

  private addAssistantMessage(
    claudeMessages: Anthropic.Messages.MessageParam[],
    message: LLMMessage
  ): void {
    if (message.role === 'assistant') {
      const content: Anthropic.Messages.ContentBlock[] = [];

      if (message.content) {
        content.push({
          type: 'text',
          text: message.content,
          citations: [],
        });
      }

      if (message.toolCalls) {
        for (const toolCall of message.toolCalls) {
          content.push({
            type: 'tool_use',
            id: toolCall.id,
            name: toolCall.name,
            input: toolCall.arguments,
          });
        }
      }

      claudeMessages.push({
        role: 'assistant',
        content,
      });
    }
  }

  private addToolResultMessage(
    claudeMessages: Anthropic.Messages.MessageParam[],
    message: LLMMessage
  ): void {
    if (message.role === 'tool') {
      const lastMessage = claudeMessages.at(-1);
      const toolResult: Anthropic.Messages.ToolResultBlockParam = {
        type: 'tool_result',
        tool_use_id: message.toolCallId,
        content: message.content,
        is_error: message.isError,
      };

      if (this.canAddToExistingToolResults(lastMessage) && lastMessage) {
        (lastMessage.content as Anthropic.Messages.ToolResultBlockParam[]).push(
          toolResult
        );
      } else {
        claudeMessages.push({
          role: 'user',
          content: [toolResult],
        });
      }
    }
  }

  private canAddToExistingToolResults(
    lastMessage: Anthropic.Messages.MessageParam | undefined
  ): boolean {
    return !!(
      lastMessage &&
      lastMessage.role === 'user' &&
      Array.isArray(lastMessage.content)
    );
  }

  private convertToolsToClaudeFormat(
    tools: LLMTool[]
  ): Anthropic.Messages.Tool[] {
    return tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.inputSchema as Record<string, unknown> & {
        type: 'object';
      },
    }));
  }

  private async callClaudeApi(
    claudeMessages: Anthropic.Messages.MessageParam[],
    claudeTools: Anthropic.Messages.Tool[]
  ): Promise<Anthropic.Messages.Message> {
    const anthropic = await this.anthropic();
    return await anthropic.messages.create({
      model,
      max_tokens: 10_000,
      messages: claudeMessages,
      tools: claudeTools,
    });
  }

  private extractToolCallsFromResponse(
    response: Anthropic.Messages.Message
  ): LLMToolCall[] {
    const toolCalls = response.content.filter(
      (block) => block.type === 'tool_use'
    ) as Anthropic.Messages.ToolUseBlock[];

    return toolCalls.map((toolCall) => ({
      name: toolCall.name,
      arguments: toolCall.input as Record<string, unknown>,
      id: toolCall.id,
    }));
  }

  private addAssistantMessageToConversation(
    conversation: LLMConversation,
    response: Anthropic.Messages.Message,
    llmToolCalls: LLMToolCall[]
  ): void {
    const textContent = response.content
      .filter((block) => block.type === 'text')
      .map((block) => (block as Anthropic.Messages.TextBlock).text)
      .join('');

    conversation.messages.push({
      role: 'assistant',
      content: textContent,
      toolCalls: llmToolCalls.length > 0 ? llmToolCalls : undefined,
    });
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
    if (toolCall.name === 'done') {
      return (toolCall.arguments as { result: string }).result;
    }
    return null;
  }
}
