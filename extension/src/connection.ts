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

export function debugLog(...args: unknown[]): void {
  const enabled = true;
  if (enabled) {
    // eslint-disable-next-line no-console
    console.log('[Extension]', ...args);
  }
}

export type ProtocolCommand = {
  id: number;
  sessionId?: string;
  method: string;
  params?: any;
};

export class Connection {
  private _debuggee: chrome.debugger.Debuggee;
  private _rootSessionId: string;
  private _ws: WebSocket;
  private _eventListener: (source: chrome.debugger.DebuggerSession, method: string, params: any) => void;
  private _detachListener: (source: chrome.debugger.Debuggee, reason: string) => void;

  constructor(tabId: number, ws: WebSocket) {
    this._debuggee = { tabId };
    this._rootSessionId = `pw-tab-${tabId}`;
    this._ws = ws;
    this._ws.onmessage = this._onMessage.bind(this);
    // Store listeners for cleanup
    this._eventListener = this._onDebuggerEvent.bind(this);
    this._detachListener = this._onDebuggerDetach.bind(this);
    chrome.debugger.onEvent.addListener(this._eventListener);
    chrome.debugger.onDetach.addListener(this._detachListener);
  }

  close(message?: string): void {
    chrome.debugger.onEvent.removeListener(this._eventListener);
    chrome.debugger.onDetach.removeListener(this._detachListener);
    this._ws.close(1000, message || 'Connection closed');
  }

  async detachDebugger(): Promise<void> {
    await chrome.debugger.detach(this._debuggee);
  }

  private _onDebuggerEvent(source: chrome.debugger.DebuggerSession, method: string, params: any): void {
    if (source.tabId !== this._debuggee.tabId)
      return;
    // If the sessionId is not provided, use the root sessionId.
    const event = {
      sessionId: source.sessionId || this._rootSessionId,
      method,
      params,
    };
    debugLog('Forwarding CDP event:', event);
    this._ws.send(JSON.stringify(event));
  }

  private _onDebuggerDetach(source: chrome.debugger.Debuggee, reason: string): void {
    if (source.tabId !== this._debuggee.tabId)
      return;
    this._sendMessage({
      method: 'PWExtension.detachedFromTab',
      params: {
        tabId: this._debuggee.tabId,
        reason,
      },
    });
  }

  private _onMessage(event: MessageEvent): void {
    this._onMessageAsync(event).catch(e => debugLog('Error handling message:', e));
  }

  private async _onMessageAsync(event: MessageEvent): Promise<void> {
    let message: ProtocolCommand;
    try {
      message = JSON.parse(event.data);
    } catch (error: any) {
      debugLog('Error parsing message:', error);
      this._sendError(-32700, `Error parsing message: ${error.message}`);
      return;
    }

    debugLog('Received message:', message);

    const sessionId = message.sessionId;
    const response: { id: any; sessionId: any; result?: any; error?: { code: number; message: string } } = {
      id: message.id,
      sessionId,
    };
    try {
      if (message.method.startsWith('PWExtension.'))
        response.result = await this._handleExtensionCommand(message);
      else
        response.result = await this._handleCDPCommand(message);
    } catch (error: any) {
      debugLog('Error handling message:', error);
      response.error = {
        code: -32000,
        message: error.message,
      };
    }
    debugLog('Sending response:', response);
    this._sendMessage(response);
  }

  private async _handleExtensionCommand(message: ProtocolCommand): Promise<any> {
    if (message.method === 'PWExtension.attachToTab') {
      debugLog('Attaching debugger to tab:', this._debuggee);
      await chrome.debugger.attach(this._debuggee, '1.3');
      const result: any = await chrome.debugger.sendCommand(this._debuggee, 'Target.getTargetInfo');
      return {
        sessionId: this._rootSessionId,
        targetInfo: result?.targetInfo,
      };
    }
    if (message.method === 'PWExtension.detachFromTab') {
      debugLog('Detaching debugger from tab:', this._debuggee);
      await this.detachDebugger();
      return;
    }
  }

  private async _handleCDPCommand(message: ProtocolCommand): Promise<any> {
    const sessionId = message.sessionId;
    const debuggerSession: chrome.debugger.DebuggerSession = { ...this._debuggee };
    // Pass session id, unless it's the root session.
    if (sessionId && sessionId !== this._rootSessionId)
      debuggerSession.sessionId = sessionId;
    // Forward CDP command to chrome.debugger
    const result = await chrome.debugger.sendCommand(
        debuggerSession,
        message.method,
        message.params
    );
    return result;
  }

  private _sendError(code: number, message: string): void {
    this._sendMessage({
      error: {
        code,
        message,
      },
    });
  }

  private _sendMessage(message: object): void {
    this._ws.send(JSON.stringify(message));
  }
}
