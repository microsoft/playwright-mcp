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

import React, { useState, useEffect, useCallback } from 'react';
import { createRoot } from 'react-dom/client';

interface TabInfo {
  id: number;
  windowId: number;
  title: string;
  url: string;
  favIconUrl?: string;
}

type StatusType = 'connected' | 'error' | 'connecting';

const ConnectApp: React.FC = () => {
  const [tabs, setTabs] = useState<TabInfo[]>([]);
  const [selectedTab, setSelectedTab] = useState<TabInfo | undefined>();
  const [status, setStatus] = useState<{ type: StatusType; message: string } | null>(null);
  const [showButtons, setShowButtons] = useState(true);
  const [showTabList, setShowTabList] = useState(true);
  const [clientInfo, setClientInfo] = useState('unknown');
  const [mcpRelayUrl, setMcpRelayUrl] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const relayUrl = params.get('mcpRelayUrl');

    if (!relayUrl) {
      setShowButtons(false);
      setStatus({ type: 'error', message: 'Missing mcpRelayUrl parameter in URL.' });
      return;
    }

    setMcpRelayUrl(relayUrl);

    try {
      const client = JSON.parse(params.get('client') || '{}');
      const info = `${client.name}/${client.version}`;
      setClientInfo(info);
      setStatus({
        type: 'connecting',
        message: `MCP client "${info}" is trying to connect. Do you want to continue?`
      });
    } catch (e) {
      setStatus({ type: 'error', message: 'Failed to parse client version.' });
      return;
    }

    void connectToMCPRelay(relayUrl);
    void loadTabs();
  }, []);

  const connectToMCPRelay = useCallback(async (mcpRelayUrl: string) => {
    const response = await chrome.runtime.sendMessage({ type: 'connectToMCPRelay', mcpRelayUrl });
    if (!response.success)
      setStatus({ type: 'error', message: 'Failed to connect to MCP relay: ' + response.error });
  }, []);

  const loadTabs = useCallback(async () => {
    const response = await chrome.runtime.sendMessage({ type: 'getTabs' });
    if (response.success) {
      setTabs(response.tabs);
      const currentTab = response.tabs.find((tab: TabInfo) => tab.id === response.currentTabId);
      setSelectedTab(currentTab);
    } else {
      setStatus({ type: 'error', message: 'Failed to load tabs: ' + response.error });
    }
  }, []);

  const handleContinue = useCallback(async () => {
    setShowButtons(false);
    setShowTabList(false);

    if (!selectedTab) {
      setStatus({ type: 'error', message: 'Tab not selected.' });
      return;
    }

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'connectToTab',
        mcpRelayUrl,
        tabId: selectedTab.id,
        windowId: selectedTab.windowId,
      });

      if (response?.success) {
        setStatus({ type: 'connected', message: `MCP client "${clientInfo}" connected.` });
      } else {
        setStatus({
          type: 'error',
          message: response?.error || `MCP client "${clientInfo}" failed to connect.`
        });
      }
    } catch (e) {
      setStatus({
        type: 'error',
        message: `MCP client "${clientInfo}" failed to connect: ${e}`
      });
    }
  }, [selectedTab, clientInfo, mcpRelayUrl]);

  const handleReject = useCallback(() => {
    setShowButtons(false);
    setShowTabList(false);
    setStatus({ type: 'error', message: 'Connection rejected. This tab can be closed.' });
  }, []);

  return (
    <div className='app-container'>
      <div className='content-wrapper'>
        <h1 className='main-title'>
          Playwright MCP Extension
        </h1>

        {status && <StatusBanner type={status.type} message={status.message} />}

        {showButtons && (
          <div className='button-container'>
            <Button variant='primary' onClick={handleContinue}>
              Continue
            </Button>
            <Button variant='default' onClick={handleReject}>
              Reject
            </Button>
          </div>
        )}


        {showTabList && (
          <div>
            <h2 className='tab-section-title'>
              Select page to expose to MCP server:
            </h2>
            <div>
              {tabs.map(tab => (
                <TabItem
                  key={tab.id}
                  tab={tab}
                  isSelected={selectedTab?.id === tab.id}
                  onSelect={() => setSelectedTab(tab)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const StatusBanner: React.FC<{ type: StatusType; message: string }> = ({ type, message }) => {
  return <div className={`status-banner ${type}`}>{message}</div>;
};

const Button: React.FC<{ variant: 'primary' | 'default'; onClick: () => void; children: React.ReactNode }> = ({
  variant,
  onClick,
  children
}) => {
  return (
    <button className={`button ${variant}`} onClick={onClick}>
      {children}
    </button>
  );
};

const TabItem: React.FC<{ tab: TabInfo; isSelected: boolean; onSelect: () => void }> = ({
  tab,
  isSelected,
  onSelect
}) => {
  const className = `tab-item ${isSelected ? 'selected' : ''}`.trim();

  return (
    <div className={className} onClick={onSelect}>
      <input
        type='radio'
        className='tab-radio'
        checked={isSelected}
      />
      <img
        src={tab.favIconUrl || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><rect width="16" height="16" fill="%23f6f8fa"/></svg>'}
        alt=''
        className='tab-favicon'
      />
      <div className='tab-content'>
        <div className='tab-title'>{tab.title || 'Untitled'}</div>
        <div className='tab-url'>{tab.url}</div>
      </div>
    </div>
  );
};


// Initialize the React app
const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<ConnectApp />);
}
