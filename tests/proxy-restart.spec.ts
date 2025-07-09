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

 import { test, expect } from './fixtures.js';

 test('browser_restart_with_proxy tool is available', async ({ client }) => {
   const { tools } = await client.listTools();
 
   const proxyRestartTool = tools.find(tool => tool.name === 'browser_restart_with_proxy');
 
   expect(proxyRestartTool).toBeDefined();
   expect(proxyRestartTool?.name).toBe('browser_restart_with_proxy');
   expect(proxyRestartTool?.description).toBe('Restart the browser with a new proxy configuration');
   expect(proxyRestartTool?.inputSchema).toBeDefined();
 });
 
 test('browser_restart_with_proxy tool has correct schema', async ({ client }) => {
   const { tools } = await client.listTools();
 
   const proxyRestartTool = tools.find(tool => tool.name === 'browser_restart_with_proxy');
 
   expect(proxyRestartTool?.inputSchema.type).toBe('object');
   expect(proxyRestartTool?.inputSchema.properties?.proxyServer).toBeDefined();
   expect(proxyRestartTool?.inputSchema.properties?.proxyServer.type).toBe('string');
   expect(proxyRestartTool?.inputSchema.properties?.proxyBypass).toBeDefined();
   expect(proxyRestartTool?.inputSchema.properties?.proxyBypass.type).toBe('string');
   expect(proxyRestartTool?.inputSchema.required).toEqual(['proxyServer']);
 });