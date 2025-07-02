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

import { RelayConnection, debugLog } from './relayConnection.js';

/**
 * Simple Chrome Extension that pumps CDP messages between chrome.debugger and WebSocket
 */

type PopupMessage = {
  type: 'getStatus' | 'connect' | 'disconnect';
  tabId: number;
  bridgeUrl?: string;
};

type SendResponse = (response: any) => void;

class TabShareExtension {
  private activeConnections: Map<number, RelayConnection>;

  constructor() {
    this.activeConnections = new Map(); // tabId -> connection

    // Remove page action click handler since we now use popup
    chrome.tabs.onRemoved.addListener(this.onTabRemoved.bind(this));

    // Handle messages from popup
    chrome.runtime.onMessage.addListener(this.onMessage.bind(this));
  }

  /**
   * Handle messages from popup
   */
  onMessage(message: PopupMessage, sender: chrome.runtime.MessageSender, sendResponse: SendResponse): boolean {
    switch (message.type) {
      case 'getStatus':
        this.getStatus(message.tabId, sendResponse);
        return true; // Will respond asynchronously

      case 'connect':
        this.connectTab(message.tabId, message.bridgeUrl!).then(
            () => sendResponse({ success: true }),
            (error: Error) => sendResponse({ success: false, error: error.message })
        );
        return true; // Will respond asynchronously

      case 'disconnect':
        this.disconnectTab(message.tabId).then(
            () => sendResponse({ success: true }),
            (error: Error) => sendResponse({ success: false, error: error.message })
        );
        return true; // Will respond asynchronously
    }
    return false;
  }

  /**
   * Get connection status for popup
   */
  getStatus(requestedTabId: number, sendResponse: SendResponse): void {
    const isConnected = this.activeConnections.size > 0;
    let activeTabId: number | null = null;

    if (isConnected) {
      const [tabId] = this.activeConnections.entries().next().value as [number, RelayConnection];
      activeTabId = tabId;

      // Get tab info
      chrome.tabs.get(tabId, tab => {
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
   */
  async connectTab(tabId: number, bridgeUrl: string): Promise<void> {
    try {
      debugLog(`Connecting tab ${tabId} to bridge at ${bridgeUrl}`);
      // Connect to bridge server
      const socket = new WebSocket(bridgeUrl);
      await new Promise<void>((resolve, reject) => {
        socket.onopen = () => resolve();
        socket.onerror = () => reject(new Error('WebSocket error'));
        setTimeout(() => reject(new Error('Connection timeout')), 5000);
      });

      const info = this._createConnection(tabId, socket);
      // Store connection
      this.activeConnections.set(tabId, info);

      await this._updateUI(tabId, { text: '●', color: '#4CAF50', title: 'Disconnect from Playwright MCP' });
      debugLog(`Tab ${tabId} connected successfully`);
    } catch (error: any) {
      debugLog(`Failed to connect tab ${tabId}:`, error.message);
      await this._cleanupConnection(tabId);

      // Show error to user
      await this._updateUI(tabId, { text: '!', color: '#F44336', title: `Connection failed: ${error.message}` });

      throw error;
    }
  }

  private async _updateUI(tabId: number, { text, color, title }: { text: string; color: string | null; title: string }): Promise<void> {
    await chrome.action.setBadgeText({ tabId, text });
    if (color)
      await chrome.action.setBadgeBackgroundColor({ tabId, color });
    await chrome.action.setTitle({ tabId, title });
  }

  private _createConnection(tabId: number, socket: WebSocket): RelayConnection {
    const connection = new RelayConnection(tabId, socket);
    socket.onclose = () => {
      debugLog(`WebSocket closed for tab ${tabId}`);
      void this.disconnectTab(tabId);
    };
    socket.onerror = error => {
      debugLog(`WebSocket error for tab ${tabId}:`, error);
      void this.disconnectTab(tabId);
    };
    return connection;
  }

  /**
   * Disconnect a tab from the bridge
   */
  async disconnectTab(tabId: number): Promise<void> {
    await this._cleanupConnection(tabId);
    await this._updateUI(tabId, { text: '', color: null, title: 'Share tab with Playwright MCP' });
    debugLog(`Tab ${tabId} disconnected`);
  }

  /**
   * Clean up connection resources
   */
  async _cleanupConnection(tabId: number): Promise<void> {
    const connection = this.activeConnections.get(tabId);
    if (!connection)
      return;

    this.activeConnections.delete(tabId);

    // Close WebSocket
    connection.close();

    // Detach debugger
    try {
      await connection.detachDebugger();
    } catch (error) {
      // Ignore detach errors - might already be detached
      debugLog('Error while detaching debugger:', error);
    }
  }

  /**
   * Handle tab removal
   */
  async onTabRemoved(tabId: number): Promise<void> {
    if (this.activeConnections.has(tabId))
      await this._cleanupConnection(tabId);
  }
}

new TabShareExtension();
