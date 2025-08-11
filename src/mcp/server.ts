import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import type {
  ImageContent,
  TextContent,
} from '@modelcontextprotocol/sdk/types.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import debug from 'debug';
import type { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { logUnhandledError } from '../log.js';
import { ManualPromise } from '../manual-promise.js';

const serverDebug = debug('pw:mcp:server');

import { logRequest } from '../utils/request-logger.js';

export type { Server } from '@modelcontextprotocol/sdk/server/index.js';
export type ClientCapabilities = {
  roots?: {
    listRoots?: boolean;
  };
};
export type ToolResponse = {
  content: (TextContent | ImageContent)[];
  isError?: boolean;
};
export type ToolSchema<Input extends z.ZodTypeAny = z.ZodTypeAny> = {
  name: string;
  title: string;
  description: string;
  inputSchema: Input;
  type: 'readOnly' | 'destructive';
};
export type ToolHandler = (
  toolName: string,
  params: Record<string, unknown>
) => Promise<ToolResponse>;
export interface ServerBackend {
  name: string;
  version: string;
  initialize?(server: Server): Promise<void>;
  tools(): ToolSchema[];
  callTool(
    schema: ToolSchema,
    parsedArguments: Record<string, unknown>
  ): Promise<ToolResponse>;
  serverClosed?(): void;
}
export type ServerBackendFactory = () => ServerBackend;
export async function connect(
  serverBackendFactory: ServerBackendFactory,
  transport: Transport,
  runHeartbeat: boolean
) {
  const backend = serverBackendFactory();
  const server = createServer(backend, runHeartbeat);
  await server.connect(transport);
}
export function createServer(
  backend: ServerBackend,
  runHeartbeat: boolean
): Server {
  const initializedPromise = new ManualPromise<void>();
  const server = new Server(
    { name: backend.name, version: backend.version },
    {
      capabilities: {
        tools: {},
      },
    }
  );
  const tools = backend.tools();
  server.setRequestHandler(ListToolsRequestSchema, () => {
    return {
      tools: tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: zodToJsonSchema(tool.inputSchema),
        annotations: {
          title: tool.title,
          readOnlyHint: tool.type === 'readOnly',
          destructiveHint: tool.type === 'destructive',
          openWorldHint: true,
        },
      })),
    };
  });
  let heartbeatRunning = false;
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    await initializedPromise;
    if (runHeartbeat && !heartbeatRunning) {
      heartbeatRunning = true;
      startHeartbeat(server);
    }
    const errorResult = (...messages: string[]) => ({
      content: [{ type: 'text', text: `### Result\n${messages.join('\n')}` }],
      isError: true,
    });
    const tool = tools.find((t) => t.name === request.params.name);
    if (!tool) {
      return errorResult(`Error: Tool "${request.params.name}" not found`);
    }
    try {
      // Log the request
      logRequest(request.params.name, request.params.arguments ?? {});

      return await backend.callTool(
        tool,
        tool.inputSchema.parse(request.params.arguments ?? {})
      );
    } catch (error) {
      return errorResult(String(error));
    }
  });
  addServerListener(server, 'initialized', () => {
    backend
      .initialize?.(server)
      .then(() => initializedPromise.resolve())
      .catch(logUnhandledError);
  });
  addServerListener(server, 'close', () => backend.serverClosed?.());
  return server;
}
const startHeartbeat = (server: Server) => {
  const beat = async () => {
    try {
      await Promise.race([
        server.ping(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('ping timeout')), 5000)
        ),
      ]);
      setTimeout(beat, 3000);
    } catch (error) {
      serverDebug('Heartbeat ping failed:', error);
      try {
        await server.close();
      } catch (closeError) {
        serverDebug(
          'Failed to close server after heartbeat failure:',
          closeError
        );
      }
    }
  };
  beat().catch((error) => {
    serverDebug('Heartbeat initialization failed:', error);
  });
};
function addServerListener(
  server: Server,
  event: 'close' | 'initialized',
  listener: () => void
) {
  const oldListener = server[`on${event}`];
  server[`on${event}`] = () => {
    oldListener?.();
    listener();
  };
}
