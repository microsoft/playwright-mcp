import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type OpenAI from 'openai';
import type {
  LLMConversation,
  LLMDelegate,
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
    // Convert generic messages to OpenAI format
    const openaiMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] =
      [];
    for (const message of conversation.messages) {
      if (message.role === 'user') {
        openaiMessages.push({
          role: 'user',
          content: message.content,
        });
      } else if (message.role === 'assistant') {
        const toolCalls: OpenAI.Chat.Completions.ChatCompletionMessageToolCall[] =
          [];
        if (message.toolCalls) {
          for (const toolCall of message.toolCalls) {
            toolCalls.push({
              id: toolCall.id,
              type: 'function',
              function: {
                name: toolCall.name,
                arguments: JSON.stringify(toolCall.arguments),
              },
            });
          }
        }
        const assistantMessage: OpenAI.Chat.Completions.ChatCompletionAssistantMessageParam =
          {
            role: 'assistant',
          };
        if (message.content) {
          assistantMessage.content = message.content;
        }
        if (toolCalls.length > 0) {
          assistantMessage.tool_calls = toolCalls;
        }
        openaiMessages.push(assistantMessage);
      } else if (message.role === 'tool') {
        openaiMessages.push({
          role: 'tool',
          tool_call_id: message.toolCallId,
          content: message.content,
        });
      }
    }
    // Convert generic tools to OpenAI format
    const openaiTools: OpenAI.Chat.Completions.ChatCompletionTool[] =
      conversation.tools.map((tool) => ({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.inputSchema,
        },
      }));
    const openai = await this.openai();
    const response = await openai.chat.completions.create({
      model,
      messages: openaiMessages,
      tools: openaiTools,
      tool_choice: 'auto',
    });
    const message = response.choices[0].message;
    // Extract tool calls and add assistant message to generic conversation
    const toolCalls = message.tool_calls || [];
    const genericToolCalls: LLMToolCall[] = toolCalls.map((toolCall) => {
      const functionCall = toolCall.function;
      return {
        name: functionCall.name,
        arguments: JSON.parse(functionCall.arguments),
        id: toolCall.id,
      };
    });
    // Add assistant message to generic conversation
    conversation.messages.push({
      role: 'assistant',
      content: message.content || '',
      toolCalls: genericToolCalls.length > 0 ? genericToolCalls : undefined,
    });
    return genericToolCalls;
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
