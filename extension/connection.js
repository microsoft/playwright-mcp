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

// @ts-check

function debugLog(...args) {
  const enabled = true;
  if (enabled) {
    console.log('[Extension]', ...args);
  }
}

export class Connection {
  /**
   * @param {number} tabId
   * @param {WebSocket} ws
   */
  constructor(tabId, ws) {
    /** @type {chrome.debugger.Debuggee} */
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

  close(message) {
    chrome.debugger.onEvent.removeListener(this._eventListener);
    chrome.debugger.onDetach.removeListener(this._detachListener);
    this._ws.close(1000, message || 'Connection closed');
  }

  async detachDebugger() {
    await chrome.debugger.detach(this._debuggee);
  }

  _onDebuggerEvent(source, method, params) {
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

  _onDebuggerDetach(source, reason) {
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

  /**
   * @param {MessageEvent} event
   */
  _onMessage(event) {
    this._onMessageAsync(event).catch(e => debugLog('Error handling message:', e));
  }

  async _onMessageAsync(event) {
    /** @type {import('../src/cdpRelay').ProtocolCommand} */
    let message;
    try {
      message = JSON.parse(event.data);
    } catch (error) {
      debugLog('Error parsing message:', error);
      this._sendError(-32700, `Error parsing message: ${error.message}`);
      return;
    }

    debugLog('Received message:', message);

    const sessionId = message.sessionId;
    const response = {
      id: message.id,
      sessionId,
    };
    try {
      if (message.method.startsWith('PWExtension.'))
        response.result = await this._handleExtensionCommand(message);
      else
        response.result = await this._handleCDPCommand(message);
    } catch (error) {
      debugLog('Error handling message:', error);
      response.error = {
        code: -32000,
        message: error.message,
      };
    }
    debugLog('Sending response:', response);
    this._sendMessage(response);
  }

  async _handleExtensionCommand(message) {
    if (message.method === 'PWExtension.attachToTab') {
      debugLog('Attaching debugger to tab:', this._debuggee);
      await chrome.debugger.attach(this._debuggee, '1.3');
      const result = /** @type {any} */ (await chrome.debugger.sendCommand(this._debuggee, 'Target.getTargetInfo'));
      return {
        sessionId: this._rootSessionId,
        targetInfo: result.targetInfo,
      };
    }
    if (message.method === 'PWExtension.detachFromTab') {
      debugLog('Detaching debugger from tab:', this._debuggee);
      await this.detachDebugger();
      return;
    }
  }

  async _handleCDPCommand(message) {
    const sessionId = message.sessionId;
    /** @type {chrome.debugger.DebuggerSession} */
    const debuggerSession = { ...this._debuggee };
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

  _sendError(code, message) {
    this._sendMessage({
      error: {
        // @ts-ignore
        code,
        message
      }
    });
  }

  /**
   * @param {import('../src/cdpRelay').ProtocolResponse} message
   */
  _sendMessage(message) {
    this._ws.send(JSON.stringify(message));
  }
}
