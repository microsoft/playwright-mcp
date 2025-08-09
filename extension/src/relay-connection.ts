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

export function debugLog(..._args: unknown[]): void {
  const enabled = true;
  if (enabled) {
    // TODO: Implement debug logging
  }
}

type ProtocolCommand = {
  id: number;
  method: string;
  params?: Record<string, unknown>;
};

type ProtocolResponse = {
  id?: number;
  method?: string;
  params?: Record<string, unknown>;
  result?: unknown;
  error?: string;
};

export class RelayConnection {
  private _debuggee: chrome.debugger.Debuggee;
  private readonly _ws: WebSocket;
  private readonly _eventListener: (
    source: chrome.debugger.DebuggerSession,
    method: string,
    params?: object
  ) => void;
  private readonly _detachListener: (
    source: chrome.debugger.Debuggee,
    reason: string
  ) => void;

  constructor(ws: WebSocket, tabId: number) {
    this._debuggee = { tabId };
    this._ws = ws;
    this._ws.onmessage = this._onMessage.bind(this);
    // Store listeners for cleanup
    this._eventListener = this._onDebuggerEvent.bind(this);
    this._detachListener = this._onDebuggerDetach.bind(this);
    chrome.debugger.onEvent.addListener(this._eventListener);
    chrome.debugger.onDetach.addListener(this._detachListener);
  }

  close(message: string): void {
    chrome.debugger.onEvent.removeListener(this._eventListener);
    chrome.debugger.onDetach.removeListener(this._detachListener);
    this._ws.close(1000, message);
  }

  private _onDebuggerEvent(
    source: chrome.debugger.DebuggerSession,
    method: string,
    params?: object
  ): void {
    if (source.tabId !== this._debuggee.tabId) {
      return;
    }
    debugLog('Forwarding CDP event:', method, params);
    const sessionId = source.sessionId;
    this._sendMessage({
      method: 'forwardCDPEvent',
      params: {
        sessionId,
        method,
        params,
      },
    });
  }

  private _onDebuggerDetach(
    source: chrome.debugger.Debuggee,
    reason: string
  ): void {
    if (source.tabId !== this._debuggee.tabId) {
      return;
    }
    this.close(`Debugger detached: ${reason}`);
    this._debuggee = {};
  }

  private _onMessage(event: MessageEvent): void {
    this._onMessageAsync(event).catch((e) =>
      debugLog('Error handling message:', e)
    );
  }

  private async _onMessageAsync(event: MessageEvent): Promise<void> {
    let message: ProtocolCommand;
    try {
      message = JSON.parse(event.data);
    } catch (error: unknown) {
      debugLog('Error parsing message:', error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this._sendError(-32_700, `Error parsing message: ${errorMessage}`);
      return;
    }

    debugLog('Received message:', message);

    const response: ProtocolResponse = {
      id: message.id,
    };
    try {
      response.result = await this._handleCommand(message);
    } catch (error: unknown) {
      debugLog('Error handling command:', error);
      response.error = error instanceof Error ? error.message : String(error);
    }
    debugLog('Sending response:', response);
    this._sendMessage(response);
  }

  private async _handleCommand(message: ProtocolCommand): Promise<unknown> {
    if (!this._debuggee.tabId) {
      throw new Error(
        'No tab is connected. Please go to the Playwright MCP extension and select the tab you want to connect to.'
      );
    }
    if (message.method === 'attachToTab') {
      debugLog('Attaching debugger to tab:', this._debuggee);
      await chrome.debugger.attach(this._debuggee, '1.3');
      const result: unknown = await chrome.debugger.sendCommand(
        this._debuggee,
        'Target.getTargetInfo'
      );
      return {
        targetInfo: (result as { targetInfo?: unknown })?.targetInfo,
      };
    }
    if (message.method === 'forwardCDPCommand') {
      const messageParams = message.params as {
        sessionId: string;
        method: string;
        params: unknown;
      };
      const { sessionId, method, params } = messageParams;
      debugLog('CDP command:', method, params);
      const debuggerSession: chrome.debugger.DebuggerSession = {
        ...this._debuggee,
        sessionId,
      };
      // Forward CDP command to chrome.debugger
      return await chrome.debugger.sendCommand(
        debuggerSession,
        method,
        params as object
      );
    }
  }

  private _sendError(code: number, message: string): void {
    this._sendMessage({
      error: {
        code,
        message,
      },
    });
  }

  private _sendMessage(message: Record<string, unknown>): void {
    this._ws.send(JSON.stringify(message));
  }
}
