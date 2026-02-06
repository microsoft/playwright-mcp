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

import { RelayConnection, debugLog } from './relayConnection';

type PageMessage = {
  type: 'connectToMCPRelay';
  mcpRelayUrl: string;
} | {
  type: 'getTabs';
} | {
  type: 'connectToTab';
  tabId?: number;
  windowId?: number;
  mcpRelayUrl: string;
} | {
  type: 'getConnectionStatus';
} | {
  type: 'disconnect';
  tabId?: number;
};

class TabShareExtension {
  private _pendingTabSelection = new Map<number, { connection: RelayConnection, timerId?: number }>();
  private _connectionsByTabId = new Map<number, RelayConnection>();

  constructor() {
    chrome.tabs.onRemoved.addListener(this._onTabRemoved.bind(this));
    chrome.tabs.onUpdated.addListener(this._onTabUpdated.bind(this));
    chrome.tabs.onActivated.addListener(this._onTabActivated.bind(this));
    chrome.runtime.onMessage.addListener(this._onMessage.bind(this));
    chrome.action.onClicked.addListener(this._onActionClicked.bind(this));
  }

  // Promise-based message handling is not supported in Chrome: https://issues.chromium.org/issues/40753031
  private _onMessage(message: PageMessage, sender: chrome.runtime.MessageSender, sendResponse: (response: any) => void) {
    switch (message.type) {
      case 'connectToMCPRelay':
        this._connectToRelay(sender.tab!.id!, message.mcpRelayUrl).then(
            () => sendResponse({ success: true }),
            (error: any) => sendResponse({ success: false, error: error.message }));
        return true;
      case 'getTabs':
        this._getTabs().then(
            tabs => sendResponse({ success: true, tabs, currentTabId: sender.tab?.id }),
            (error: any) => sendResponse({ success: false, error: error.message }));
        return true;
      case 'connectToTab':
        const tabId = message.tabId || sender.tab?.id!;
        const windowId = message.windowId || sender.tab?.windowId!;
        this._connectTab(sender.tab!.id!, tabId, windowId, message.mcpRelayUrl!).then(
            () => sendResponse({ success: true }),
            (error: any) => sendResponse({ success: false, error: error.message }));
        return true; // Return true to indicate that the response will be sent asynchronously
      case 'getConnectionStatus':
        sendResponse({
          // Backward-compatible shape for existing UI; `connectedTabId` is the first connected tab (if any).
          connectedTabId: this._connectionsByTabId.keys().next().value ?? null,
          connectedTabIds: [...this._connectionsByTabId.keys()],
        });
        return false;
      case 'disconnect':
        this._disconnect(message.tabId).then(
            () => sendResponse({ success: true }),
            (error: any) => sendResponse({ success: false, error: error.message }));
        return true;
    }
    return false;
  }

  private async _connectToRelay(selectorTabId: number, mcpRelayUrl: string): Promise<void> {
    try {
      debugLog(`Connecting to relay at ${mcpRelayUrl}`);
      // Only one pending connection per selector tab.
      this._pendingTabSelection.get(selectorTabId)?.connection.close('A new connection is requested from this tab');
      this._pendingTabSelection.delete(selectorTabId);

      const socket = new WebSocket(mcpRelayUrl);
      await new Promise<void>((resolve, reject) => {
        socket.onopen = () => resolve();
        socket.onerror = () => reject(new Error('WebSocket error'));
        setTimeout(() => reject(new Error('Connection timeout')), 5000);
      });

      const connection = new RelayConnection(socket);
      connection.onclose = () => {
        debugLog('Connection closed');
        this._pendingTabSelection.delete(selectorTabId);
        // TODO: show error in the selector tab?
      };
      this._pendingTabSelection.set(selectorTabId, { connection });
      debugLog(`Connected to MCP relay`);
    } catch (error: any) {
      const message = `Failed to connect to MCP relay: ${error.message}`;
      debugLog(message);
      throw new Error(message);
    }
  }

  private async _connectTab(selectorTabId: number, tabId: number, windowId: number, mcpRelayUrl: string): Promise<void> {
    try {
      debugLog(`Connecting tab ${tabId} to relay at ${mcpRelayUrl}`);
      const connection = this._pendingTabSelection.get(selectorTabId)?.connection;
      if (!connection)
        throw new Error('No active MCP relay connection');
      this._pendingTabSelection.delete(selectorTabId);

      // If the tab is already connected, replace the existing connection (we only allow one connection per tab).
      const existing = this._connectionsByTabId.get(tabId);
      if (existing && existing !== connection)
        existing.close('Another connection is requested for this tab');

      connection.setTabId(tabId);
      connection.onclose = () => {
        debugLog('MCP connection closed');
        // Only clean up if this tab is still mapped to this connection.
        if (this._connectionsByTabId.get(tabId) === connection) {
          this._connectionsByTabId.delete(tabId);
          void this._updateBadge(tabId, { text: '' });
        }
      };

      this._connectionsByTabId.set(tabId, connection);

      // Do not steal focus by default; focusing the tab/window is a UX choice.
      await this._updateBadge(tabId, { text: '✓', color: '#4CAF50', title: 'Connected to MCP client' });
      debugLog(`Connected to MCP bridge`);
    } catch (error: any) {
      debugLog(`Failed to connect tab ${tabId}:`, error.message);
      throw error;
    }
  }

  private async _updateBadge(tabId: number, { text, color, title }: { text: string; color?: string, title?: string }): Promise<void> {
    try {
      await chrome.action.setBadgeText({ tabId, text });
      await chrome.action.setTitle({ tabId, title: title || '' });
      if (color)
        await chrome.action.setBadgeBackgroundColor({ tabId, color });
    } catch (error: any) {
      // Ignore errors as the tab may be closed already.
    }
  }

  private async _onTabRemoved(tabId: number): Promise<void> {
    const pendingConnection = this._pendingTabSelection.get(tabId)?.connection;
    if (pendingConnection) {
      this._pendingTabSelection.delete(tabId);
      pendingConnection.close('Browser tab closed');
      return;
    }
    const existingConnection = this._connectionsByTabId.get(tabId);
    if (!existingConnection)
      return;
    this._connectionsByTabId.delete(tabId);
    existingConnection.close('Browser tab closed');
  }

  private _onTabActivated(activeInfo: chrome.tabs.TabActiveInfo) {
    for (const [tabId, pending] of this._pendingTabSelection) {
      if (tabId === activeInfo.tabId) {
        if (pending.timerId) {
          clearTimeout(pending.timerId);
          pending.timerId = undefined;
        }
        continue;
      }
      if (!pending.timerId) {
        pending.timerId = setTimeout(() => {
          const existed = this._pendingTabSelection.delete(tabId);
          if (existed) {
            pending.connection.close('Tab has been inactive for 5 seconds');
            chrome.tabs.sendMessage(tabId, { type: 'connectionTimeout' });
          }
        }, 5000);
        return;
      }
    }
  }

  private _onTabUpdated(tabId: number, changeInfo: chrome.tabs.TabChangeInfo, tab: chrome.tabs.Tab) {
    if (this._connectionsByTabId.has(tabId))
      void this._updateBadge(tabId, { text: '✓', color: '#4CAF50', title: 'Connected to MCP client' });
  }

  private async _getTabs(): Promise<chrome.tabs.Tab[]> {
    const tabs = await chrome.tabs.query({});
    return tabs.filter(tab => tab.url && !['chrome:', 'edge:', 'devtools:'].some(scheme => tab.url!.startsWith(scheme)));
  }

  private async _onActionClicked(): Promise<void> {
    await chrome.tabs.create({
      url: chrome.runtime.getURL('status.html'),
      active: true
    });
  }

  private async _disconnect(tabId?: number): Promise<void> {
    if (tabId) {
      const connection = this._connectionsByTabId.get(tabId);
      if (!connection)
        return;
      this._connectionsByTabId.delete(tabId);
      connection.close('User disconnected');
      await this._updateBadge(tabId, { text: '' });
      return;
    }

    for (const [connectedTabId, connection] of this._connectionsByTabId) {
      this._connectionsByTabId.delete(connectedTabId);
      connection.close('User disconnected');
      await this._updateBadge(connectedTabId, { text: '' });
    }
    for (const [selectorTabId, pending] of this._pendingTabSelection) {
      this._pendingTabSelection.delete(selectorTabId);
      pending.connection.close('User disconnected');
    }
  }
}

new TabShareExtension();
