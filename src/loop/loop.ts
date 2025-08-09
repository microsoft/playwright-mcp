import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type {
  ImageContent,
  TextContent,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import debug from 'debug';
import { getErrorMessage } from '../utils/common-formatters.js';
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

  return await runConversationLoopRecursive(
    delegate,
    client,
    conversation,
    oneShot,
    0,
    MAX_ITERATIONS
  );
}

async function runConversationLoopRecursive(
  delegate: LLMDelegate,
  client: Client,
  conversation: LLMConversation,
  oneShot: boolean,
  iteration: number,
  maxIterations: number
): Promise<LLMMessage[]> {
  if (iteration >= maxIterations) {
    throw new Error('Failed to perform step, max attempts reached');
  }

  const result = await executeIteration(
    delegate,
    client,
    conversation,
    iteration
  );

  if (shouldTerminateLoop(result, oneShot)) {
    return conversation.messages;
  }

  return await runConversationLoopRecursive(
    delegate,
    client,
    conversation,
    oneShot,
    iteration + 1,
    maxIterations
  );
}

function shouldTerminateLoop(
  result: { isDone: boolean },
  oneShot: boolean
): boolean {
  return result.isDone || oneShot;
}

async function executeIteration(
  delegate: LLMDelegate,
  client: Client,
  conversation: LLMConversation,
  iteration: number
): Promise<{ isDone: boolean }> {
  debug('history')('Making API call for iteration', iteration);
  const toolCalls = await delegate.makeApiCall(conversation);

  validateToolCallsPresent(toolCalls);

  const { toolResults, isDone } = await processToolCalls(
    delegate,
    client,
    toolCalls
  );

  return handleIterationResult(delegate, conversation, toolResults, isDone);
}

function validateToolCallsPresent(toolCalls: LLMToolCall[]): void {
  if (toolCalls.length === 0) {
    throw new Error('Call the "done" tool when the task is complete.');
  }
}

function handleIterationResult(
  delegate: LLMDelegate,
  conversation: LLMConversation,
  toolResults: Array<{
    toolCallId: string;
    content: string;
    isError?: boolean;
  }>,
  isDone: boolean
): { isDone: boolean } {
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
  const toolResults = createEmptyToolResults();

  const processResult = await processAllToolCallsSequentially(
    delegate,
    client,
    toolCalls,
    toolResults
  );

  return processResult || { toolResults, isDone: false };
}

async function processAllToolCallsSequentially(
  delegate: LLMDelegate,
  client: Client,
  toolCalls: LLMToolCall[],
  toolResults: Array<{ toolCallId: string; content: string; isError?: boolean }>
): Promise<{
  toolResults: Array<{
    toolCallId: string;
    content: string;
    isError?: boolean;
  }>;
  isDone: boolean;
} | null> {
  // Process tool calls sequentially to maintain correct execution order
  return await processToolCallsRecursive(
    delegate,
    client,
    toolCalls,
    toolResults,
    0
  );
}

async function processToolCallsRecursive(
  delegate: LLMDelegate,
  client: Client,
  toolCalls: LLMToolCall[],
  toolResults: Array<{
    toolCallId: string;
    content: string;
    isError?: boolean;
  }>,
  index: number
): Promise<{
  toolResults: Array<{
    toolCallId: string;
    content: string;
    isError?: boolean;
  }>;
  isDone: boolean;
} | null> {
  if (index >= toolCalls.length) {
    return null;
  }

  const toolCall = toolCalls[index];
  const processingResult = await processSingleToolCall(
    delegate,
    client,
    toolCall,
    toolCalls,
    toolResults
  );

  if (shouldReturnEarly(processingResult)) {
    return createProcessResult(processingResult, toolResults);
  }

  return await processToolCallsRecursive(
    delegate,
    client,
    toolCalls,
    toolResults,
    index + 1
  );
}

function shouldReturnEarly(processingResult: {
  isDone: boolean;
  shouldBreak: boolean;
}): boolean {
  return processingResult.isDone || processingResult.shouldBreak;
}

function createProcessResult(
  processingResult: { isDone: boolean; shouldBreak: boolean },
  toolResults: Array<{ toolCallId: string; content: string; isError?: boolean }>
): {
  toolResults: Array<{
    toolCallId: string;
    content: string;
    isError?: boolean;
  }>;
  isDone: boolean;
} {
  return {
    toolResults,
    isDone: processingResult.isDone,
  };
}

function createEmptyToolResults(): Array<{
  toolCallId: string;
  content: string;
  isError?: boolean;
}> {
  return [];
}

async function processSingleToolCall(
  delegate: LLMDelegate,
  client: Client,
  toolCall: LLMToolCall,
  allToolCalls: LLMToolCall[],
  toolResults: Array<{ toolCallId: string; content: string; isError?: boolean }>
): Promise<{ isDone: boolean; shouldBreak: boolean }> {
  if (isToolCallDone(delegate, toolCall)) {
    return createDoneResult();
  }

  const executionResult = await processIndividualToolCall(
    client,
    toolCall,
    allToolCalls,
    toolResults
  );

  return createContinueResult(executionResult.shouldBreak);
}

function isToolCallDone(delegate: LLMDelegate, toolCall: LLMToolCall): boolean {
  const doneCheck = checkForDoneToolCall(delegate, toolCall);
  return doneCheck.isDone;
}

function createDoneResult(): { isDone: boolean; shouldBreak: boolean } {
  return { isDone: true, shouldBreak: false };
}

function createContinueResult(shouldBreak: boolean): {
  isDone: boolean;
  shouldBreak: boolean;
} {
  return { isDone: false, shouldBreak };
}

async function processIndividualToolCall(
  client: Client,
  toolCall: LLMToolCall,
  allToolCalls: LLMToolCall[],
  toolResults: Array<{ toolCallId: string; content: string; isError?: boolean }>
): Promise<{ shouldBreak: boolean }> {
  const result = await executeToolCall(client, toolCall);
  toolResults.push(result);

  if (shouldBreakOnError(result, allToolCalls, toolCall, toolResults)) {
    return { shouldBreak: true };
  }

  return { shouldBreak: false };
}

function checkForDoneToolCall(
  delegate: LLMDelegate,
  toolCall: LLMToolCall
): { isDone: boolean } {
  const doneResult = delegate.checkDoneToolCall(toolCall);
  return { isDone: doneResult !== null };
}

function shouldBreakOnError(
  result: { toolCallId: string; content: string; isError?: boolean },
  toolCalls: LLMToolCall[],
  currentToolCall: LLMToolCall,
  toolResults: Array<{ toolCallId: string; content: string; isError?: boolean }>
): boolean {
  if (result.isError) {
    addSkippedToolResults(toolCalls, currentToolCall, toolResults);
    return true;
  }
  return false;
}

async function executeToolCall(
  client: Client,
  toolCall: LLMToolCall
): Promise<{ toolCallId: string; content: string; isError?: boolean }> {
  const { name, arguments: args, id } = toolCall;

  try {
    debug('tool')(name, args);
    const response = await client.callTool({ name, arguments: args });
    const responseContent = (response.content ?? []) as (
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
