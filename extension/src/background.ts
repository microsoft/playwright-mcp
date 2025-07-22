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

type PageMessage = {
  type: 'connectToMCPRelay';
  mcpRelayUrl: string;
};

class TabShareExtension {
  private _activeConnection: RelayConnection | undefined;
  private _connectedTabId: number | null = null;

  constructor() {
    chrome.tabs.onRemoved.addListener(this._onTabRemoved.bind(this));
    chrome.tabs.onUpdated.addListener(this._onTabUpdated.bind(this));
    chrome.runtime.onMessage.addListener(this._onMessage.bind(this));
  }

  // Promise-based message handling is not supported in Chrome: https://issues.chromium.org/issues/40753031
  private _onMessage(message: PageMessage, sender: chrome.runtime.MessageSender, sendResponse: (response: any) => void) {
    switch (message.type) {
      case 'connectToMCPRelay':
        const tabId = sender.tab?.id;
        if (!tabId) {
          sendResponse({ success: false, error: 'No tab id' });
          return true;
        }
        this._connectTab(tabId, message.mcpRelayUrl!).then(
            () => sendResponse({ success: true }),
            (error: any) => sendResponse({ success: false, error: error.message }));
        return true; // Return true to indicate that the response will be sent asynchronously
    }
    return false;
  }

  private async _connectTab(tabId: number, mcpRelayUrl: string): Promise<void> {
    try {
      debugLog(`Connecting tab ${tabId} to bridge at ${mcpRelayUrl}`);
      const socket = new WebSocket(mcpRelayUrl);
      await new Promise<void>((resolve, reject) => {
        socket.onopen = () => resolve();
        socket.onerror = () => reject(new Error('WebSocket error'));
        setTimeout(() => reject(new Error('Connection timeout')), 5000);
      });

      const connection = new RelayConnection(socket);
      const connectionClosed = (m: string) => {
        debugLog(m);
        if (this._activeConnection === connection) {
          this._activeConnection = undefined;
          void this._setConnectedTabId(null);
        }
      };
      socket.onclose = () => connectionClosed('WebSocket closed');
      socket.onerror = error => connectionClosed(`WebSocket error: ${error}`);
      this._activeConnection = connection;

      connection.setConnectedTabId(tabId);
      await this._setConnectedTabId(tabId);
      debugLog(`Tab ${tabId} connected successfully`);
    } catch (error: any) {
      debugLog(`Failed to connect tab ${tabId}:`, error.message);
      await this._setConnectedTabId(null);
      throw error;
    }
  }

  private async _setConnectedTabId(tabId: number | null): Promise<void> {
    const oldTabId = this._connectedTabId;
    this._connectedTabId = tabId;
    if (oldTabId && oldTabId !== tabId)
      await this._updateBadge(oldTabId, { text: '', color: null });
    if (tabId)
      await this._updateBadge(tabId, { text: '●', color: '#4CAF50' });
  }

  private async _updateBadge(tabId: number, { text, color }: { text: string; color: string | null }): Promise<void> {
    await chrome.action.setBadgeText({ tabId, text });
    if (color)
      await chrome.action.setBadgeBackgroundColor({ tabId, color });
  }

  private async _onTabRemoved(tabId: number): Promise<void> {
    if (this._connectedTabId === tabId)
      this._activeConnection!.setConnectedTabId(null);
  }

  private async _onTabUpdated(tabId: number, changeInfo: chrome.tabs.TabChangeInfo, tab: chrome.tabs.Tab): Promise<void> {
    if (changeInfo.status === 'complete' && this._connectedTabId === tabId)
      await this._setConnectedTabId(tabId);
  }
}

new TabShareExtension();
