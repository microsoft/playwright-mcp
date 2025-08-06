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
import { FullConfig } from '../config.js';
import { Server, ServerBackend, ToolSchema } from '../mcp/server.js';
import { filteredTools } from '../tools.js';
import { ProcessHost } from './processHost.js';
import { VSCodeInitParams } from './vscodeMain.js';

export class VSCodeServerBackend extends ProcessHost implements ServerBackend {
  readonly name = '';
  readonly version = '';
  private _tools: ToolSchema<any>[] = [];

  private constructor() {
    super(new URL('./vscodeMain.js', import.meta.url).pathname, {});
    this.on('changeProxyTarget', target => this.onChangeProxyTarget?.(target));
  }

  private async _start(config: FullConfig, connectionString: string, lib: string) {
    this._tools = filteredTools(config).map(tool => tool.schema);
    const params: VSCodeInitParams = { config, connectionString, lib };
    const error = await this.startRunner(params);
    if (error)
      throw error;
  }

  static async start(config: FullConfig, connectionString: string, lib: string): Promise<VSCodeServerBackend> {
    const backend = new VSCodeServerBackend();
    await backend._start(config, connectionString, lib);
    return backend;
  }

  tools(): ToolSchema<any>[] {
    return this._tools;
  }

  serverClosed?() {
    void this.stop();
  }

  onChangeProxyTarget?: ((target: { kind: 'vscode'; connectionString: string; lib: string; } | { kind: 'default'; }) => void) | undefined;

  async callTool(schema: ToolSchema<any>, parsedArguments: any) {
    const response = await this.sendMessage({
      method: 'callTool',
      params: {
        toolName: schema.name,
        parsedArguments,
      },
    });
    return response as any;
  }

  async initialize(server: Server) {
    await this.sendMessage({
      method: 'initialize',
      params: {
        capabilities: server.getClientCapabilities(),
        roots: await server.listRoots(),
        clientVersion: server.getClientVersion()
      }
    });
  }
}
