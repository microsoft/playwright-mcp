/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { z } from 'zod';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { ManualPromise } from '../manualPromise.js';
import { logUnhandledError } from '../log.js';

import type { ImageContent, Implementation, ListRootsResult, TextContent } from '@modelcontextprotocol/sdk/types.js';
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

export interface InitializeInfo {
  clientVersion: Implementation;
  roots?: ListRootsResult;
}

export interface ServerBackend {
  name: string;
  version: string;
  initialize?(info: InitializeInfo): Promise<void>;
  tools(): ToolSchema<any>[];
  callTool(schema: ToolSchema<any>, parsedArguments: any): Promise<ToolResponse>;
  serverClosed?(): void;

  onChangeProxyTarget?: (target: string, options: any) => void;
}

export type ServerBackendFactory = () => ServerBackend;

export class ServerBackendSwitcher implements ServerBackend {
  private _target: ServerBackend;
  private _initializeInfo?: InitializeInfo;

  constructor(private readonly _targetFactories: Record<string, (options: any) => ServerBackend>) {
    const defaultTargetFactory = this._targetFactories[''];
    this._target = defaultTargetFactory({});
    this._target.onChangeProxyTarget = this._handleChangeProxyTarget;
  }

  _handleChangeProxyTarget = (name: string, options: any) => {
    const factory = this._targetFactories[name];
    if (!factory)
      throw new Error(`Unknown target: ${name}`);
    const target = factory(options);
    this.switch(target).catch(logUnhandledError);
  };

  async switch(target: ServerBackend) {
    const old = this._target;
    old.onChangeProxyTarget = undefined;
    this._target = target;
    this._target.onChangeProxyTarget = this._handleChangeProxyTarget;
    if (this._initializeInfo) {
      old.serverClosed?.();
      await this.initialize(this._initializeInfo);
    }
  }

  get name() {
    return this._target.name;
  }

  get version() {
    return this._target.version;
  }

  async initialize(info: InitializeInfo): Promise<void> {
    this._initializeInfo = info;
    await this._target.initialize?.(info);
  }

  tools(): ToolSchema<any>[] {
    return this._target.tools();
  }

  async callTool(schema: ToolSchema<any>, parsedArguments: any): Promise<ToolResponse> {
    return this._target.callTool(schema, parsedArguments);
  }

  serverClosed(): void {
    this._target.serverClosed?.();
    this._initializeInfo = undefined;
  }
}

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

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    await initializedPromise;
    return { tools: backend.tools().map(tool => ({
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
    const tool = backend.tools().find(tool => tool.name === request.params.name) as ToolSchema<any>;
    if (!tool)
      return errorResult(`Error: Tool "${request.params.name}" not found`);

    try {
      return await backend.callTool(tool, tool.inputSchema.parse(request.params.arguments || {}));
    } catch (error) {
      return errorResult(String(error));
    }
  });
  addServerListener(server, 'initialized', async () => {
    try {
      const info = await getInitializeInfo(server);
      await backend.initialize?.(info);
      initializedPromise.resolve();
    } catch (e) {
      logUnhandledError(e);
    }
  });
  addServerListener(server, 'close', () => backend.serverClosed?.());
  return server;
}

async function getInitializeInfo(server: Server) {
  const info: InitializeInfo = {
    clientVersion: server.getClientVersion()!,
  };
  if (server.getClientCapabilities()?.roots?.listRoots && isVSCode(info.clientVersion))
    info.roots = await server.listRoots();
  return info;
}

export function isVSCode(clientVersion: Implementation): boolean {
  return clientVersion.name === 'Visual Studio Code' || clientVersion.name === 'Visual Studio Code - Insiders';
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
