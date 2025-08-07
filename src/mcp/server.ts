import { z } from 'zod';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { ManualPromise } from '../manualPromise.js';
import { logUnhandledError } from '../log.js';
import { logRequest } from '../utils/requestLogger.js';
import type { ImageContent, TextContent } from '@modelcontextprotocol/sdk/types.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
export type { Server } from '@modelcontextprotocol/sdk/server/index.js';
export type ClientCapabilities = {
  roots?: {
    listRoots?: boolean
  };
};
export type ToolResponse = {
  content: (TextContent | ImageContent)[];
  isError?: boolean;
};
export type ToolSchema<Input extends z.Schema> = {
  name: string;
  title: string;
  description: string;
  inputSchema: Input;
  type: 'readOnly' | 'destructive';
};
export type ToolHandler = (toolName: string, params: any) => Promise<ToolResponse>;
export interface ServerBackend {
  name: string;
  version: string;
  initialize?(server: Server): Promise<void>;
  tools(): ToolSchema<any>[];
  callTool(schema: ToolSchema<any>, parsedArguments: any): Promise<ToolResponse>;
  serverClosed?(): void;
}
export type ServerBackendFactory = () => ServerBackend;
export async function connect(serverBackendFactory: ServerBackendFactory, transport: Transport, runHeartbeat: boolean) {
  const backend = serverBackendFactory();
  const server = createServer(backend, runHeartbeat);
  await server.connect(transport);
}
export function createServer(backend: ServerBackend, runHeartbeat: boolean): Server {
  const initializedPromise = new ManualPromise<void>();
  const server = new Server({ name: backend.name, version: backend.version }, {
    capabilities: {
      tools: {},
    }
  });
  const tools = backend.tools();
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: zodToJsonSchema(tool.inputSchema),
      annotations: {
        title: tool.title,
        readOnlyHint: tool.type === 'readOnly',
        destructiveHint: tool.type === 'destructive',
        openWorldHint: true,
      },
    })) };
  });
  let heartbeatRunning = false;
  server.setRequestHandler(CallToolRequestSchema, async request => {
    await initializedPromise;
    if (runHeartbeat && !heartbeatRunning) {
      heartbeatRunning = true;
      startHeartbeat(server);
    }
    const errorResult = (...messages: string[]) => ({
      content: [{ type: 'text', text: '### Result\n' + messages.join('\n') }],
      isError: true,
    });
    const tool = tools.find(tool => tool.name === request.params.name) as ToolSchema<any>;
    if (!tool)
      return errorResult(`Error: Tool "${request.params.name}" not found`);
    try {
      // Log the request
      logRequest(request.params.name, request.params.arguments || {});
      
      return await backend.callTool(tool, tool.inputSchema.parse(request.params.arguments || {}));
    } catch (error) {
      return errorResult(String(error));
    }
  });
  addServerListener(server, 'initialized', () => {
    backend.initialize?.(server).then(() => initializedPromise.resolve()).catch(logUnhandledError);
  });
  addServerListener(server, 'close', () => backend.serverClosed?.());
  return server;
}
const startHeartbeat = (server: Server) => {
  const beat = () => {
    Promise.race([
      server.ping(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('ping timeout')), 5000)),
    ]).then(() => {
      setTimeout(beat, 3000);
    }).catch(() => {
      void server.close();
    });
  };
  beat();
};
function addServerListener(server: Server, event: 'close' | 'initialized', listener: () => void) {
  const oldListener = server[`on${event}`];
  server[`on${event}`] = () => {
    oldListener?.();
    listener();
  };
}
