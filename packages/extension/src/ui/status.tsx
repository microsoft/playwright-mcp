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

import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { Button, TabItem } from './tabItem';

import type { TabInfo } from './tabItem';
import { AuthTokenSection } from './authToken';

type ConnectionInfo = {
  mcpRelayUrl: string;
  connectedTabId: number;
  playwrightTabIds: number[];
  connectedTab?: TabInfo;
  playwrightTabs: TabInfo[];
};

const StatusApp: React.FC = () => {
  const [connections, setConnections] = useState<ConnectionInfo[]>([]);

  useEffect(() => {
    void loadStatus();
  }, []);

  const loadStatus = async () => {
    const { connections: rawConnections = [] } = await chrome.runtime.sendMessage({ type: 'getConnectionStatus' });

    const fetchTab = async (id: number): Promise<TabInfo | null> => {
      try {
        const tab = await chrome.tabs.get(id);
        return { id: tab.id!, windowId: tab.windowId!, title: tab.title!, url: tab.url!, favIconUrl: tab.favIconUrl };
      } catch {
        return null;
      }
    };

    const resolved: ConnectionInfo[] = await Promise.all(
        rawConnections.map(async (c: { mcpRelayUrl: string, connectedTabId: number, playwrightTabIds: number[] }) => {
          const connectedTab = await fetchTab(c.connectedTabId) ?? undefined;
          const playwrightTabs = (await Promise.all(c.playwrightTabIds.map(fetchTab))).filter((t): t is TabInfo => t !== null);
          return { ...c, connectedTab, playwrightTabs };
        })
    );
    setConnections(resolved);
  };

  const openTab = async (tabId: number) => {
    await chrome.tabs.update(tabId, { active: true });
    window.close();
  };

  const disconnect = async (mcpRelayUrl: string) => {
    await chrome.runtime.sendMessage({ type: 'disconnect', mcpRelayUrl });
    void loadStatus();
  };

  return (
    <div className='app-container'>
      <div className='content-wrapper'>
        {connections.length === 0 ? (
          <div className='status-banner'>
            No MCP clients are currently connected.
          </div>
        ) : connections.map((c, i) => (
          <div key={c.mcpRelayUrl}>
            {connections.length > 1 && (
              <div className='tab-section-title'>
                Instance {i + 1}:
              </div>
            )}
            {c.connectedTab && (
              <div>
                <div className='tab-section-title'>
                  Page with connected MCP client:
                </div>
                <TabItem
                  tab={c.connectedTab}
                  button={
                    <Button variant='primary' onClick={() => disconnect(c.mcpRelayUrl)}>
                      Disconnect
                    </Button>
                  }
                  onClick={() => openTab(c.connectedTabId)}
                />
              </div>
            )}
            {c.playwrightTabs.length > 0 && (
              <div>
                <div className='tab-section-title'>
                  Playwright managed tabs:
                </div>
                {c.playwrightTabs.map(tab => (
                  <TabItem
                    key={tab.id}
                    tab={tab}
                    onClick={() => openTab(tab.id)}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
        <AuthTokenSection />
      </div>
    </div>
  );
};

// Initialize the React app
const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<StatusApp />);
}
