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

import type * as React from 'react';
import { useCallback, useEffect, useState } from 'react';
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
  const [status, setStatus] = useState<{
    type: StatusType;
    message: string;
  } | null>(null);
  const [showButtons, setShowButtons] = useState(true);
  const [showTabList, setShowTabList] = useState(true);
  const [clientInfo, setClientInfo] = useState('unknown');
  const [mcpRelayUrl, setMcpRelayUrl] = useState('');

  const loadTabs = useCallback(async () => {
    const response = await chrome.runtime.sendMessage({ type: 'getTabs' });
    if (response.success) {
      setTabs(response.tabs);
      const currentTab = response.tabs.find(
        (tab: TabInfo) => tab.id === response.currentTabId
      );
      setSelectedTab(currentTab);
    } else {
      setStatus({
        type: 'error',
        message: `Failed to load tabs: ${response.error}`,
      });
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const relayUrl = params.get('mcpRelayUrl');

    if (!relayUrl) {
      setShowButtons(false);
      setStatus({
        type: 'error',
        message: 'Missing mcpRelayUrl parameter in URL.',
      });
      return;
    }

    setMcpRelayUrl(relayUrl);

    try {
      const client = JSON.parse(params.get('client') || '{}');
      const info = `${client.name}/${client.version}`;
      setClientInfo(info);
      setStatus({
        type: 'connecting',
        message: `MCP client "${info}" is trying to connect. Do you want to continue?`,
      });
    } catch (_error) {
      // Error logging is intentionally suppressed to comply with linting rules
      // Error handling continues through status update
      setStatus({ type: 'error', message: 'Failed to parse client version.' });
      return;
    }

    loadTabs().catch(() => {
      // Tab loading errors are handled in the loadTabs function
    });
  }, [loadTabs]);

  const handleContinue = useCallback(async () => {
    setShowButtons(false);
    setShowTabList(false);

    if (!selectedTab) {
      setStatus({ type: 'error', message: 'Tab not selected.' });
      return;
    }

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'connectToMCPRelay',
        mcpRelayUrl,
        tabId: selectedTab.id,
        windowId: selectedTab.windowId,
      });

      if (response?.success) {
        setStatus({
          type: 'connected',
          message: `MCP client "${clientInfo}" connected.`,
        });
      } else {
        setStatus({
          type: 'error',
          message:
            response?.error || `MCP client "${clientInfo}" failed to connect.`,
        });
      }
    } catch (e) {
      setStatus({
        type: 'error',
        message: `MCP client "${clientInfo}" failed to connect: ${e}`,
      });
    }
  }, [selectedTab, clientInfo, mcpRelayUrl]);

  const handleReject = useCallback(() => {
    setShowButtons(false);
    setShowTabList(false);
    setStatus({
      type: 'error',
      message: 'Connection rejected. This tab can be closed.',
    });
  }, []);

  return (
    <div className="app-container">
      <div className="content-wrapper">
        <h1 className="main-title">Playwright MCP Extension</h1>

        {status && <StatusBanner message={status.message} type={status.type} />}

        {showButtons && (
          <div className="button-container">
            <Button onClick={handleContinue} variant="primary">
              Continue
            </Button>
            <Button onClick={handleReject} variant="default">
              Reject
            </Button>
          </div>
        )}

        {showTabList && (
          <div>
            <h2 className="tab-section-title" id="tab-section-title">
              Select page to expose to MCP server:
            </h2>
            <div aria-labelledby="tab-section-title" role="radiogroup">
              {tabs.map((tab) => (
                <TabItem
                  isSelected={selectedTab?.id === tab.id}
                  key={tab.id}
                  onSelect={() => setSelectedTab(tab)}
                  tab={tab}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const StatusBanner: React.FC<{ type: StatusType; message: string }> = ({
  type,
  message,
}) => {
  const ariaLive = type === 'error' ? 'assertive' : 'polite';

  return (
    <output
      aria-atomic="true"
      aria-live={ariaLive}
      className={`status-banner ${type}`}
    >
      {message}
    </output>
  );
};

const Button: React.FC<{
  variant: 'primary' | 'default';
  onClick: () => void;
  children: React.ReactNode;
}> = ({ variant, onClick, children }) => {
  return (
    <button className={`button ${variant}`} onClick={onClick} type="button">
      {children}
    </button>
  );
};

const TabItem: React.FC<{
  tab: TabInfo;
  isSelected: boolean;
  onSelect: () => void;
}> = ({ tab, isSelected, onSelect }) => {
  const className = `tab-item ${isSelected ? 'selected' : ''}`.trim();

  const handleChange = () => {
    onSelect();
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect();
    }
  };

  return (
    <div
      aria-checked={isSelected}
      className={className}
      onClick={onSelect}
      onKeyDown={handleKeyDown}
      role="radio"
      tabIndex={0}
    >
      <input
        checked={isSelected}
        className="tab-radio"
        name="selected-tab"
        onChange={handleChange}
        tabIndex={-1}
        type="radio"
      />
      {/* biome-ignore lint/performance/noImgElement: Using img is appropriate for simple favicon display in Chrome extension */}
      <img
        alt={`Favicon for ${tab.title || 'tab'}`}
        className="tab-favicon"
        src={
          tab.favIconUrl ||
          'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><rect width="16" height="16" fill="%23f6f8fa"/></svg>'
        }
      />
      <div className="tab-content">
        <div className="tab-title">{tab.title || 'Untitled'}</div>
        <div className="tab-url">{tab.url}</div>
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
