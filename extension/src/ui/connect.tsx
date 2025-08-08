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
        message: `🎭 Playwright MCP started from  "${info}" is trying to connect. Do you want to continue?`
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
    if (response.success)
      setTabs(response.tabs);
    else
      setStatus({ type: 'error', message: 'Failed to load tabs: ' + response.error });
  }, []);

  const handleConnectToTab = useCallback(async (tab: TabInfo) => {
    setShowButtons(false);
    setShowTabList(false);

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'connectToTab',
        mcpRelayUrl,
        tabId: tab.id,
        windowId: tab.windowId,
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
  }, [clientInfo, mcpRelayUrl]);

  const handleReject = useCallback(() => {
    setShowButtons(false);
    setShowTabList(false);
    setStatus({ type: 'error', message: 'Connection rejected. This tab can be closed.' });
  }, []);

  useEffect(() => {
    const listener = (message: any) => {
      if (message.type === 'connectionTimeout')
        handleReject();
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => {
      chrome.runtime.onMessage.removeListener(listener);
    };
  }, []);

  return (
    <div className='app-container'>
      <div className='content-wrapper'>
        {status && (
          <div className='status-container'>
            <StatusBanner type={status.type} message={status.message} />
            {showButtons && (
              <Button variant='reject' onClick={handleReject}>
                Reject
              </Button>
            )}
          </div>
        )}

        {showTabList && (
          <div>
            <div className='tab-section-title'>
              Select page to expose to MCP server:
            </div>
            <div>
              {tabs.map(tab => (
                <TabItem
                  key={tab.id}
                  tab={tab}
                  onConnect={() => handleConnectToTab(tab)}
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

const Button: React.FC<{ variant: 'primary' | 'default' | 'reject'; onClick: () => void; children: React.ReactNode }> = ({
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

const TabItem: React.FC<{ tab: TabInfo; onConnect: () => void }> = ({
  tab,
  onConnect
}) => {
  return (
    <div className='tab-item'>
      <img
        src={tab.favIconUrl || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><rect width="16" height="16" fill="%23f6f8fa"/></svg>'}
        alt=''
        className='tab-favicon'
      />
      <div className='tab-content'>
        <div className='tab-title'>{tab.title || 'Untitled'}</div>
        <div className='tab-url'>{tab.url}</div>
      </div>
      <Button variant='primary' onClick={onConnect}>
        Connect
      </Button>
    </div>
  );
};


// Initialize the React app
const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<ConnectApp />);
}
