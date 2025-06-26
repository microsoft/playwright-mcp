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

import { Connection } from './connection.js';

/**
 * Simple Chrome Extension that pumps CDP messages between chrome.debugger and WebSocket
 */

// @ts-check

function debugLog(...args) {
  const enabled = true;
  if (enabled) {
    console.log('[Extension]', ...args);
  }
}

class TabShareExtension {
  constructor() {
    this.activeConnections = new Map(); // tabId -> connection info

    // Remove page action click handler since we now use popup
    chrome.tabs.onRemoved.addListener(this.onTabRemoved.bind(this));

    // Handle messages from popup
    chrome.runtime.onMessage.addListener(this.onMessage.bind(this));
  }

  /**
   * Handle messages from popup
   * @param {any} message
   * @param {chrome.runtime.MessageSender} sender
   * @param {Function} sendResponse
   */
  onMessage(message, sender, sendResponse) {
    switch (message.type) {
      case 'getStatus':
        this.getStatus(message.tabId, sendResponse);
        return true; // Will respond asynchronously

      case 'connect':
        this.connectTab(message.tabId, message.bridgeUrl).then(
          () => sendResponse({ success: true }),
          (error) => sendResponse({ success: false, error: error.message })
        );
        return true; // Will respond asynchronously

      case 'disconnect':
        this.disconnectTab(message.tabId).then(
          () => sendResponse({ success: true }),
          (error) => sendResponse({ success: false, error: error.message })
        );
        return true; // Will respond asynchronously
    }
    return false;
  }

  /**
   * Get connection status for popup
   * @param {number} requestedTabId
   * @param {Function} sendResponse
   */
  getStatus(requestedTabId, sendResponse) {
    const isConnected = this.activeConnections.size > 0;
    let activeTabId = null;
    let activeTabInfo = null;

    if (isConnected) {
      const [tabId, connection] = this.activeConnections.entries().next().value;
      activeTabId = tabId;

      // Get tab info
      chrome.tabs.get(tabId, (tab) => {
        if (chrome.runtime.lastError) {
          sendResponse({
            isConnected: false,
            error: 'Active tab not found'
          });
        } else {
          sendResponse({
            isConnected: true,
            activeTabId,
            activeTabInfo: {
              title: tab.title,
              url: tab.url
            }
          });
        }
      });
    } else {
      sendResponse({
        isConnected: false,
        activeTabId: null,
        activeTabInfo: null
      });
    }
  }

  /**
   * Connect a tab to the bridge server
   * @param {number} tabId
   * @param {string} bridgeUrl
   */
  async connectTab(tabId, bridgeUrl) {
    try {
      debugLog(`Connecting tab ${tabId} to bridge at ${bridgeUrl}`);
      // Connect to bridge server
      const socket = new WebSocket(bridgeUrl);
      await new Promise((resolve, reject) => {
        socket.onopen = () => resolve(undefined);
        socket.onerror = reject;
        setTimeout(() => reject(new Error('Connection timeout')), 5000);
      });

      const info = this._createConnection(tabId, socket);
      // Store connection
      this.activeConnections.set(tabId, info);

      this._updateUI(tabId, { text: '●', color: '#4CAF50', title: 'Disconnect from Playwright MCP' });
      debugLog(`Tab ${tabId} connected successfully`);
    } catch (error) {
      debugLog(`Failed to connect tab ${tabId}:`, error.message);
      await this._cleanupConnection(tabId);

      // Show error to user
      this._updateUI(tabId, { text: '!', color: '#F44336', title: `Connection failed: ${error.message}` });

      throw error; // Re-throw for popup to handle
    }
  }

  _updateUI(tabId, { text, color, title }) {
    chrome.action.setBadgeText({ tabId, text });
    if (color)
      chrome.action.setBadgeBackgroundColor({ tabId, color });
    chrome.action.setTitle({ tabId, title });
  }

  _createConnection(tabId, socket) {
    const connection = new Connection(tabId, socket);
    socket.onclose = () => {
      debugLog(`WebSocket closed for tab ${tabId}`);
      this.disconnectTab(tabId);
    };
    socket.onerror = (error) => {
      debugLog(`WebSocket error for tab ${tabId}:`, error);
      this.disconnectTab(tabId);
    };
    return { connection };
  }

  /**
   * Disconnect a tab from the bridge
   * @param {number} tabId
   */
  async disconnectTab(tabId) {
    await this._cleanupConnection(tabId);
    this._updateUI(tabId, { text: '', color: null, title: 'Share tab with Playwright MCP' });
    debugLog(`Tab ${tabId} disconnected`);
  }

  /**
   * Clean up connection resources
   * @param {number} tabId
   */
  async _cleanupConnection(tabId) {
    const info = this.activeConnections.get(tabId);
    if (!info) return;
    this.activeConnections.delete(tabId);

    // Close WebSocket
    info.connection.close();

    // Detach debugger
    try {
      await info.connection.detachDebugger();
    } catch (error) {
      // Ignore detach errors - might already be detached
      debugLog('Error while detaching debugger:', error);
    }
  }

  /**
   * Handle tab removal
   * @param {number} tabId
   */
  async onTabRemoved(tabId) {
    if (this.activeConnections.has(tabId))
      await this._cleanupConnection(tabId);
  }
}

new TabShareExtension();
