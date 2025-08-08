import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type OpenAI from 'openai';
import type {
  LLMConversation,
  LLMDelegate,
  LLMMessage,
  LLMTool,
  LLMToolCall,
} from './loop.js';

const model = 'gpt-4.1';
export class OpenAIDelegate implements LLMDelegate {
  private _openai: OpenAI | undefined;
  async openai(): Promise<OpenAI> {
    if (!this._openai) {
      const oai = await import('openai');
      this._openai = new oai.OpenAI();
    }
    return this._openai;
  }
  createConversation(
    task: string,
    tools: Tool[],
    oneShot: boolean
  ): LLMConversation {
    const genericTools: LLMTool[] = tools.map((tool) => ({
      name: tool.name,
      description: tool.description || '',
      inputSchema: tool.inputSchema,
    }));
    if (!oneShot) {
      genericTools.push({
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
      tools: genericTools,
    };
  }
  async makeApiCall(conversation: LLMConversation): Promise<LLMToolCall[]> {
    const openaiMessages = this.convertMessagesToOpenAIFormat(
      conversation.messages
    );
    const openaiTools = this.convertToolsToOpenAIFormat(conversation.tools);

    const openai = await this.openai();
    const response = await openai.chat.completions.create({
      model,
      messages: openaiMessages,
      tools: openaiTools,
      tool_choice: 'auto',
    });

    const message = response.choices[0].message;
    const genericToolCalls = this.extractToolCallsFromResponse(message);

    this.addAssistantMessageToConversation(
      conversation,
      message,
      genericToolCalls
    );

    return genericToolCalls;
  }

  private convertMessagesToOpenAIFormat(
    messages: LLMMessage[]
  ): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
    const openaiMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] =
      [];

    for (const message of messages) {
      const convertedMessage = this.convertSingleMessageToOpenAI(message);
      if (convertedMessage) {
        openaiMessages.push(convertedMessage);
      }
    }

    return openaiMessages;
  }

  private convertSingleMessageToOpenAI(
    message: LLMMessage
  ): OpenAI.Chat.Completions.ChatCompletionMessageParam | null {
    if (message.role === 'user') {
      return {
        role: 'user',
        content: message.content,
      };
    }

    if (message.role === 'assistant') {
      return this.convertAssistantMessage(message);
    }

    if (message.role === 'tool') {
      return {
        role: 'tool',
        tool_call_id: message.toolCallId,
        content: message.content,
      };
    }

    return null;
  }

  private convertAssistantMessage(
    message: LLMMessage
  ): OpenAI.Chat.Completions.ChatCompletionAssistantMessageParam {
    if (message.role !== 'assistant') {
      throw new Error('Expected assistant message');
    }

    const assistantMessage: OpenAI.Chat.Completions.ChatCompletionAssistantMessageParam =
      {
        role: 'assistant',
      };

    if (message.content) {
      assistantMessage.content = message.content;
    }

    if (
      message.role === 'assistant' &&
      message.toolCalls &&
      message.toolCalls.length > 0
    ) {
      assistantMessage.tool_calls = this.convertToolCallsToOpenAI(
        message.toolCalls
      );
    }

    return assistantMessage;
  }

  private convertToolCallsToOpenAI(
    toolCalls: LLMToolCall[]
  ): OpenAI.Chat.Completions.ChatCompletionMessageToolCall[] {
    return toolCalls.map((toolCall) => ({
      id: toolCall.id,
      type: 'function',
      function: {
        name: toolCall.name,
        arguments: JSON.stringify(toolCall.arguments),
      },
    }));
  }

  private convertToolsToOpenAIFormat(
    tools: LLMTool[]
  ): OpenAI.Chat.Completions.ChatCompletionTool[] {
    return tools.map((tool) => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema,
      },
    }));
  }

  private extractToolCallsFromResponse(
    message: OpenAI.Chat.Completions.ChatCompletionMessage
  ): LLMToolCall[] {
    const toolCalls = message.tool_calls || [];
    return toolCalls.map((toolCall) => {
      const functionCall = toolCall.function;
      return {
        name: functionCall.name,
        arguments: JSON.parse(functionCall.arguments),
        id: toolCall.id,
      };
    });
  }

  private addAssistantMessageToConversation(
    conversation: LLMConversation,
    message: OpenAI.Chat.Completions.ChatCompletionMessage,
    genericToolCalls: LLMToolCall[]
  ): void {
    conversation.messages.push({
      role: 'assistant',
      content: message.content || '',
      toolCalls: genericToolCalls.length > 0 ? genericToolCalls : undefined,
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
      return (toolCall.arguments as { result?: string }).result || '';
    }
    return null;
  }
}
