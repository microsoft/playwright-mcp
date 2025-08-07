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
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { ManualPromise } from '../manualPromise.js';
import { logUnhandledError } from '../log.js';
import { logRequest } from '../utils/requestLogger.js';
export async function connect(serverBackendFactory, transport, runHeartbeat) {
    const backend = serverBackendFactory();
    const server = createServer(backend, runHeartbeat);
    await server.connect(transport);
}
export function createServer(backend, runHeartbeat) {
    const initializedPromise = new ManualPromise();
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
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
        await initializedPromise;
        if (runHeartbeat && !heartbeatRunning) {
            heartbeatRunning = true;
            startHeartbeat(server);
        }
        const errorResult = (...messages) => ({
            content: [{ type: 'text', text: '### Result\n' + messages.join('\n') }],
            isError: true,
        });
        const tool = tools.find(tool => tool.name === request.params.name);
        if (!tool)
            return errorResult(`Error: Tool "${request.params.name}" not found`);
        try {
            // Log the request
            logRequest(request.params.name, request.params.arguments || {});
            return await backend.callTool(tool, tool.inputSchema.parse(request.params.arguments || {}));
        }
        catch (error) {
            return errorResult(String(error));
        }
    });
    addServerListener(server, 'initialized', () => {
        backend.initialize?.(server).then(() => initializedPromise.resolve()).catch(logUnhandledError);
    });
    addServerListener(server, 'close', () => backend.serverClosed?.());
    return server;
}
const startHeartbeat = (server) => {
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
function addServerListener(server, event, listener) {
    const oldListener = server[`on${event}`];
    server[`on${event}`] = () => {
        oldListener?.();
        listener();
    };
}
