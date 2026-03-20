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

interface ConnectionStatus {
  isConnected: boolean;
  connectedTabId: number | null;
  connectedTab?: TabInfo;
  playwrightTabs: TabInfo[];
}

const StatusApp: React.FC = () => {
  const [status, setStatus] = useState<ConnectionStatus>({
    isConnected: false,
    connectedTabId: null,
    playwrightTabs: [],
  });

  useEffect(() => {
    void loadStatus();
  }, []);

  const loadStatus = async () => {
    const { connectedTabId, playwrightTabIds = [] } = await chrome.runtime.sendMessage({ type: 'getConnectionStatus' });

    const fetchTab = async (id: number): Promise<TabInfo | null> => {
      try {
        const tab = await chrome.tabs.get(id);
        return { id: tab.id!, windowId: tab.windowId!, title: tab.title!, url: tab.url!, favIconUrl: tab.favIconUrl };
      } catch {
        return null;
      }
    };

    const connectedTab = connectedTabId ? await fetchTab(connectedTabId) ?? undefined : undefined;
    const playwrightTabs = (await Promise.all((playwrightTabIds as number[]).map(fetchTab))).filter((t): t is TabInfo => t !== null);

    setStatus({
      isConnected: !!connectedTabId,
      connectedTabId,
      connectedTab,
      playwrightTabs,
    });
  };

  const openTab = async (tabId: number) => {
    await chrome.tabs.update(tabId, { active: true });
    window.close();
  };

  const disconnect = async () => {
    await chrome.runtime.sendMessage({ type: 'disconnect' });
    window.close();
  };

  return (
    <div className='app-container'>
      <div className='content-wrapper'>
        {status.isConnected && status.connectedTab ? (
          <div>
            <div className='tab-section-title'>
              Page with connected MCP client:
            </div>
            <div>
              <TabItem
                tab={status.connectedTab}
                button={
                  <Button variant='primary' onClick={disconnect}>
                    Disconnect
                  </Button>
                }
                onClick={() => openTab(status.connectedTabId!)}
              />
            </div>
          </div>
        ) : (
          <div className='status-banner'>
            No MCP clients are currently connected.
          </div>
        )}
        {status.playwrightTabs.length > 0 && (
          <div>
            <div className='tab-section-title'>
              Playwright managed tabs:
            </div>
            <div>
              {status.playwrightTabs.map(tab => (
                <TabItem
                  key={tab.id}
                  tab={tab}
                  onClick={() => openTab(tab.id)}
                />
              ))}
            </div>
          </div>
        )}
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
