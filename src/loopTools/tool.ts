import type { z } from 'zod';
import type * as mcpServer from '../mcp/server.js';
import type { Context } from './context.js';
export type Tool<Input extends z.ZodType = z.ZodType<any, any, any>> = {
  schema: mcpServer.ToolSchema<Input>;
  handle: (
    context: Context,
    params: z.output<Input>
  ) => Promise<mcpServer.ToolResponse>;
};
export function defineTool<Input extends z.ZodType>(
  tool: Tool<Input>
): Tool<Input> {
  return tool;
}
