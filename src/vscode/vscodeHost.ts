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
import { InitializeInfo, ServerBackend, ToolSchema } from '../mcp/server.js';
import { packageJSON } from '../package.js';
import { filteredTools } from '../tools.js';
import { ProcessHost } from './processHost.js';
import { VSCodeInitParams } from './vscodeMain.js';

export class VSCodeServerBackend extends ProcessHost implements ServerBackend {
  readonly name = 'Playwright';
  readonly version = packageJSON.version;

  onChangeProxyTarget?: (target: string, options: any) => void;

  constructor(private _config: FullConfig, private _connectionString: string, private _lib: string) {
    super(new URL('./vscodeMain.js', import.meta.url).pathname, {});
    this.on('changeProxyTarget', ({ target, options }) => this.onChangeProxyTarget?.(target, options));
  }

  async initialize(info: InitializeInfo) {
    const params: VSCodeInitParams = {
      config: this._config,
      connectionString: this._connectionString,
      lib: this._lib,
    };
    const error = await this.startRunner(params);
    if (error)
      throw error;

    await this.sendMessage({
      method: 'initialize',
      params: info
    });
  }

  tools(): ToolSchema<any>[] {
    return filteredTools(this._config).map(tool => tool.schema);
  }

  serverClosed?() {
    void this.stop();
  }

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
}
