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
import { Button, TabItem  } from './tabItem';

import type { TabInfo } from './tabItem';
import { AuthTokenSection } from './authToken';

interface ConnectionStatus {
  connectedTabs: TabInfo[];
}

const StatusApp: React.FC = () => {
  const [status, setStatus] = useState<ConnectionStatus>({
    connectedTabs: []
  });

  useEffect(() => {
    void loadStatus();
  }, []);

  const loadStatus = async () => {
    // Get current connection status from background script
    const response = await chrome.runtime.sendMessage({ type: 'getConnectionStatus' });
    const connectedTabIds: number[] = Array.isArray(response?.connectedTabIds)
      ? response.connectedTabIds
      : (response?.connectedTabId ? [response.connectedTabId] : []);

    const tabs = await Promise.all(connectedTabIds.map(async tabId => {
      try {
        const tab = await chrome.tabs.get(tabId);
        const tabInfo: TabInfo = {
          id: tab.id!,
          windowId: tab.windowId!,
          title: tab.title!,
          url: tab.url!,
          ...(tab.favIconUrl ? { favIconUrl: tab.favIconUrl } : {}),
        };
        return tabInfo;
      } catch {
        return null;
      }
    }));

    setStatus({
      connectedTabs: tabs.filter((t): t is TabInfo => t !== null)
    });
  };

  const openConnectedTab = async (tabId: number) => {
    await chrome.tabs.update(tabId, { active: true });
    window.close();
  };

  const disconnect = async (tabId: number) => {
    await chrome.runtime.sendMessage({ type: 'disconnect', tabId });
    window.close();
  };

  return (
    <div className='app-container'>
      <div className='content-wrapper'>
        {status.connectedTabs.length ? (
          <div>
            <div className='tab-section-title'>
              Pages with connected MCP clients:
            </div>
            <div>
              {status.connectedTabs.map(tab => (
                <TabItem
                  key={tab.id}
                  tab={tab}
                  button={
                    <Button variant='primary' onClick={() => disconnect(tab.id)}>
                      Disconnect
                    </Button>
                  }
                  onClick={() => openConnectedTab(tab.id)}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className='status-banner'>
            No MCP clients are currently connected.
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
