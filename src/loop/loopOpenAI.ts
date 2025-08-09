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
      description: tool.description ?? '',
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
    const formattedData = this.formatConversationForOpenAI(conversation);
    const response = await this.executeOpenAIRequest(
      formattedData.messages,
      formattedData.tools
    );
    const message = response.choices[0].message;
    const genericToolCalls = this.extractToolCallsFromResponse(message);

    this.addAssistantMessageToConversation(
      conversation,
      message,
      genericToolCalls
    );

    return genericToolCalls;
  }

  private formatConversationForOpenAI(conversation: LLMConversation): {
    messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[];
    tools: OpenAI.Chat.Completions.ChatCompletionTool[];
  } {
    return {
      messages: this.convertMessagesToOpenAIFormat(conversation.messages),
      tools: this.convertToolsToOpenAIFormat(conversation.tools),
    };
  }

  private async executeOpenAIRequest(
    messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
    tools: OpenAI.Chat.Completions.ChatCompletionTool[]
  ): Promise<OpenAI.Chat.Completions.ChatCompletion> {
    const openai = await this.openai();
    return await openai.chat.completions.create({
      model,
      messages,
      tools,
      tool_choice: 'auto',
    });
  }

  private convertMessagesToOpenAIFormat(
    messages: LLMMessage[]
  ): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
    return messages
      .map((message) => this.convertSingleMessageToOpenAI(message))
      .filter(
        (
          message
        ): message is OpenAI.Chat.Completions.ChatCompletionMessageParam =>
          message !== null
      );
  }

  private convertSingleMessageToOpenAI(
    message: LLMMessage
  ): OpenAI.Chat.Completions.ChatCompletionMessageParam | null {
    const converters = this.createMessageConverters(message);
    const converter = converters[message.role];
    return converter ? converter() : null;
  }

  private createMessageConverters(
    message: LLMMessage
  ): Record<string, () => OpenAI.Chat.Completions.ChatCompletionMessageParam> {
    return {
      user: () => this.createUserMessage(message),
      assistant: () => this.convertAssistantMessage(message),
      tool: () => this.createToolMessage(message),
    };
  }

  private createUserMessage(
    message: LLMMessage
  ): OpenAI.Chat.Completions.ChatCompletionUserMessageParam {
    return {
      role: 'user',
      content: message.content,
    };
  }

  private createToolMessage(
    message: LLMMessage
  ): OpenAI.Chat.Completions.ChatCompletionToolMessageParam {
    return {
      role: 'tool',
      tool_call_id: (message as { toolCallId: string }).toolCallId,
      content: message.content,
    };
  }

  private convertAssistantMessage(
    message: LLMMessage
  ): OpenAI.Chat.Completions.ChatCompletionAssistantMessageParam {
    if (message.role !== 'assistant') {
      throw new Error('Expected assistant message');
    }

    const assistantMessage: OpenAI.Chat.Completions.ChatCompletionAssistantMessageParam =
      { role: 'assistant' };

    this.addContentToAssistantMessage(assistantMessage, message);
    this.addToolCallsToAssistantMessage(assistantMessage, message);

    return assistantMessage;
  }

  private addContentToAssistantMessage(
    assistantMessage: OpenAI.Chat.Completions.ChatCompletionAssistantMessageParam,
    message: LLMMessage
  ): void {
    if (message.content) {
      assistantMessage.content = message.content;
    }
  }

  private addToolCallsToAssistantMessage(
    assistantMessage: OpenAI.Chat.Completions.ChatCompletionAssistantMessageParam,
    message: LLMMessage
  ): void {
    if (
      message.role === 'assistant' &&
      message.toolCalls &&
      message.toolCalls.length > 0
    ) {
      assistantMessage.tool_calls = this.convertToolCallsToOpenAI(
        message.toolCalls
      );
    }
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
    const toolCalls = message.tool_calls ?? [];
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
      content: message.content ?? '',
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
      return (toolCall.arguments as { result?: string }).result ?? '';
    }
    return null;
  }
}
