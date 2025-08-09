import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type {
  ImageContent,
  TextContent,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import debug from 'debug';
import { getErrorMessage } from '../utils/commonFormatters.js';
export type LLMToolCall = {
  name: string;
  arguments: Record<string, unknown>;
  id: string;
};
export type LLMTool = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
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
  createConversation(
    task: string,
    tools: Tool[],
    oneShot: boolean
  ): LLMConversation;
  makeApiCall(conversation: LLMConversation): Promise<LLMToolCall[]>;
  addToolResults(
    conversation: LLMConversation,
    results: Array<{ toolCallId: string; content: string; isError?: boolean }>
  ): void;
  checkDoneToolCall(toolCall: LLMToolCall): string | null;
}
export async function runTask(
  delegate: LLMDelegate,
  client: Client,
  task: string,
  oneShot = false
): Promise<LLMMessage[]> {
  const { tools } = await client.listTools();
  const taskContent = createTaskContent(task, oneShot);
  const conversation = delegate.createConversation(taskContent, tools, oneShot);

  return await runConversationLoop(delegate, client, conversation, oneShot);
}

async function runConversationLoop(
  delegate: LLMDelegate,
  client: Client,
  conversation: LLMConversation,
  oneShot: boolean
): Promise<LLMMessage[]> {
  const MAX_ITERATIONS = 5;

  for (let iteration = 0; iteration < MAX_ITERATIONS; ++iteration) {
    // biome-ignore lint/nursery/noAwaitInLoop: Sequential conversation flow - each iteration depends on previous results
    const result = await executeIteration(
      delegate,
      client,
      conversation,
      iteration
    );

    if (result.isDone || oneShot) {
      return conversation.messages;
    }
  }

  throw new Error('Failed to perform step, max attempts reached');
}

async function executeIteration(
  delegate: LLMDelegate,
  client: Client,
  conversation: LLMConversation,
  iteration: number
): Promise<{ isDone: boolean }> {
  debug('history')('Making API call for iteration', iteration);
  const toolCalls = await delegate.makeApiCall(conversation);

  if (toolCalls.length === 0) {
    throw new Error('Call the "done" tool when the task is complete.');
  }

  const { toolResults, isDone } = await processToolCalls(
    delegate,
    client,
    toolCalls
  );

  if (isDone) {
    return { isDone: true };
  }

  delegate.addToolResults(conversation, toolResults);
  return { isDone: false };
}

function createTaskContent(task: string, oneShot: boolean): string {
  if (oneShot) {
    return `Perform following task: ${task}.`;
  }
  return `Perform following task: ${task}. Once the task is complete, call the "done" tool.`;
}

async function processToolCalls(
  delegate: LLMDelegate,
  client: Client,
  toolCalls: LLMToolCall[]
): Promise<{
  toolResults: Array<{
    toolCallId: string;
    content: string;
    isError?: boolean;
  }>;
  isDone: boolean;
}> {
  const toolResults: Array<{
    toolCallId: string;
    content: string;
    isError?: boolean;
  }> = [];

  for (const toolCall of toolCalls) {
    const doneResult = delegate.checkDoneToolCall(toolCall);
    if (doneResult !== null) {
      return { toolResults, isDone: true };
    }

    // biome-ignore lint/nursery/noAwaitInLoop: tool calls may have dependencies and must execute sequentially
    const result = await executeToolCall(client, toolCall);
    toolResults.push(result);

    if (result.isError) {
      addSkippedToolResults(toolCalls, toolCall, toolResults);
      break;
    }
  }

  return { toolResults, isDone: false };
}

async function executeToolCall(
  client: Client,
  toolCall: LLMToolCall
): Promise<{ toolCallId: string; content: string; isError?: boolean }> {
  const { name, arguments: args, id } = toolCall;

  try {
    debug('tool')(name, args);
    const response = await client.callTool({ name, arguments: args });
    const responseContent = (response.content || []) as (
      | TextContent
      | ImageContent
    )[];
    debug('tool')(responseContent);

    const text = extractTextFromResponse(responseContent);
    return { toolCallId: id, content: text };
  } catch (error) {
    debug('tool')(error);
    return {
      toolCallId: id,
      content: `Error while executing tool "${name}": ${getErrorMessage(error)}\n\nPlease try to recover and complete the task.`,
      isError: true,
    };
  }
}

function extractTextFromResponse(
  responseContent: (TextContent | ImageContent)[]
): string {
  return responseContent
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('\n');
}

function addSkippedToolResults(
  toolCalls: LLMToolCall[],
  currentToolCall: LLMToolCall,
  toolResults: Array<{ toolCallId: string; content: string; isError?: boolean }>
): void {
  const remainingToolCalls = toolCalls.slice(
    toolCalls.indexOf(currentToolCall) + 1
  );

  for (const remainingToolCall of remainingToolCalls) {
    toolResults.push({
      toolCallId: remainingToolCall.id,
      content: 'This tool call is skipped due to previous error.',
      isError: true,
    });
  }
}
