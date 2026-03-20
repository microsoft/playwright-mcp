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

type ConnectionState = {
  connection: RelayConnection;
  connectedTabId: number;
  playwrightTabIds: Set<number>;
  mcpRelayUrl: string;
};

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
  mcpRelayUrl?: string;
};

class TabShareExtension {
  private _connections = new Map<string, ConnectionState>();
  private _pendingTabSelection = new Map<number, { connection: RelayConnection, mcpRelayUrl: string, timerId?: number }>();

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
          connections: [...this._connections.values()].map(s => ({
            mcpRelayUrl: s.mcpRelayUrl,
            connectedTabId: s.connectedTabId,
            playwrightTabIds: [...s.playwrightTabIds],
          })),
          // Legacy fields for backward compat: first connection's tabId
          connectedTabId: [...this._connections.values()][0]?.connectedTabId ?? null,
          playwrightTabIds: [...this._connections.values()].flatMap(s => [...s.playwrightTabIds]),
        });
        return false;
      case 'disconnect':
        this._disconnect(message.mcpRelayUrl).then(
            () => sendResponse({ success: true }),
            (error: any) => sendResponse({ success: false, error: error.message }));
        return true;
    }
    return false;
  }

  private async _connectToRelay(selectorTabId: number, mcpRelayUrl: string): Promise<void> {
    try {
      debugLog(`Connecting to relay at ${mcpRelayUrl}`);
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
      this._pendingTabSelection.set(selectorTabId, { connection, mcpRelayUrl });
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

      const pending = this._pendingTabSelection.get(selectorTabId);
      if (!pending)
        throw new Error('No active MCP relay connection');
      this._pendingTabSelection.delete(selectorTabId);

      const connection = pending.connection;
      const relayUrl = pending.mcpRelayUrl;

      // Close any existing connection on the same relay URL.
      const existing = this._connections.get(relayUrl);
      if (existing) {
        existing.connection.close('Another connection is requested');
        this._connections.delete(relayUrl);
      }

      const state: ConnectionState = {
        connection,
        connectedTabId: tabId,
        playwrightTabIds: new Set(),
        mcpRelayUrl: relayUrl,
      };
      this._connections.set(relayUrl, state);

      connection.setTabId(tabId);
      connection.onclose = () => {
        debugLog('MCP connection closed');
        if (this._connections.get(relayUrl)?.connection === connection)
          this._connections.delete(relayUrl);
        void this._updateBadge(state.connectedTabId, { text: '' });
        for (const pwTabId of state.playwrightTabIds)
          void this._updateBadge(pwTabId, { text: '' });
        state.playwrightTabIds.clear();
      };
      connection.onPlaywrightTabCreated = (pwTabId: number) => {
        state.playwrightTabIds.add(pwTabId);
        void this._updateBadge(pwTabId, { text: '✓', color: '#1976D2', title: 'Playwright managed tab' });
      };
      connection.onPlaywrightTabRemoved = (pwTabId: number) => {
        state.playwrightTabIds.delete(pwTabId);
        void this._updateBadge(pwTabId, { text: '' });
      };

      await Promise.all([
        this._updateBadge(tabId, { text: '✓', color: '#4CAF50', title: 'Connected to MCP client' }),
        chrome.tabs.update(tabId, { active: true }),
        chrome.windows.update(windowId, { focused: true }),
      ]);
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
    const pendingConnection = [...this._pendingTabSelection.entries()].find(([k]) => k === tabId)?.[1];
    if (pendingConnection) {
      this._pendingTabSelection.delete(tabId);
      pendingConnection.connection.close('Browser tab closed');
      return;
    }
    for (const [relayUrl, state] of this._connections) {
      if (state.playwrightTabIds.has(tabId)) {
        state.playwrightTabIds.delete(tabId);
        return;
      }
      if (state.connectedTabId === tabId) {
        state.connection.close('Browser tab closed');
        this._connections.delete(relayUrl);
        return;
      }
    }
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
      }
    }
  }

  private _onTabUpdated(tabId: number, changeInfo: chrome.tabs.TabChangeInfo, tab: chrome.tabs.Tab) {
    for (const state of this._connections.values()) {
      if (state.connectedTabId === tabId)
        void this._updateBadge(tabId, { text: '✓', color: '#4CAF50', title: 'Connected to MCP client' });
      if (state.playwrightTabIds.has(tabId))
        void this._updateBadge(tabId, { text: '✓', color: '#1976D2', title: 'Playwright managed tab' });
    }
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

  private async _disconnect(mcpRelayUrl?: string): Promise<void> {
    if (mcpRelayUrl) {
      const state = this._connections.get(mcpRelayUrl);
      if (state) {
        state.connection.close('User disconnected');
        this._connections.delete(mcpRelayUrl);
      }
    } else {
      for (const state of this._connections.values())
        state.connection.close('User disconnected');
      this._connections.clear();
    }
  }
}

new TabShareExtension();
