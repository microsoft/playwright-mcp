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
import { Button, TabItem  } from './tabItem.js';
import type { TabInfo } from './tabItem.js';

type Status =
  | { type: 'connecting'; message: string }
  | { type: 'connected'; message: string }
  | { type: 'error'; message: string }
  | { type: 'error'; versionMismatch: { pwMcpVersion: string; extensionVersion: string; downloadUrl: string } };

const ConnectApp: React.FC = () => {
  const [tabs, setTabs] = useState<TabInfo[]>([]);
  const [status, setStatus] = useState<Status | null>(null);
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

    const pwMcpVersion = params.get('pwMcpVersion');
    const extensionVersion = chrome.runtime.getManifest().version;
    if (pwMcpVersion !== extensionVersion) {
      const downloadUrl = params.get('downloadUrl') || `https://github.com/microsoft/playwright-mcp/releases/download/v${extensionVersion}/playwright-mcp-extension-v${extensionVersion}.zip`;
      setShowButtons(false);
      setShowTabList(false);
      setStatus({
        type: 'error',
        versionMismatch: {
          pwMcpVersion: pwMcpVersion || 'unknown',
          extensionVersion,
          downloadUrl
        }
      });
      return;
    }

    void connectToMCPRelay(relayUrl);
    void loadTabs();
  }, []);

  const handleReject = useCallback((message: string) => {
    setShowButtons(false);
    setShowTabList(false);
    setStatus({ type: 'error', message });
  }, []);

  const connectToMCPRelay = useCallback(async (mcpRelayUrl: string) => {

    const response = await chrome.runtime.sendMessage({ type: 'connectToMCPRelay', mcpRelayUrl  });
    if (!response.success)
      handleReject(response.error);
  }, [handleReject]);

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

  useEffect(() => {
    const listener = (message: any) => {
      if (message.type === 'connectionTimeout')
        handleReject('Connection timed out.');
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => {
      chrome.runtime.onMessage.removeListener(listener);
    };
  }, [handleReject]);

  return (
    <div className='app-container'>
      <div className='content-wrapper'>
        {status && (
          <div className='status-container'>
            <StatusBanner status={status} />
            {showButtons && (
              <Button variant='reject' onClick={() => handleReject('Connection rejected. This tab can be closed.')}>
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
                  button={
                    <Button variant='primary' onClick={() => handleConnectToTab(tab)}>
                      Connect
                    </Button>
                  }
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const VersionMismatchError: React.FC<{ pwMcpVersion: string; extensionVersion: string; downloadUrl: string }> = ({ pwMcpVersion, extensionVersion, downloadUrl }) => {
  const readmeUrl = 'https://github.com/microsoft/playwright-mcp/blob/main/extension/README.md';

  const handleDownloadAndOpenExtensions = () => {
    // Start download
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `playwright-mcp-extension-v${extensionVersion}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(() => {
      chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
        if (tabs[0]?.id)
          chrome.tabs.update(tabs[0].id, { url: 'chrome://extensions/' });
      });
    }, 1000); // Wait 1 second for download to initiate
  };

  return (
    <div>
      Incompatible Playwright MCP version: {pwMcpVersion} (extension version: {extensionVersion}).{' '}
      <button
        onClick={handleDownloadAndOpenExtensions}
        className='link-button'
      >Click here</button> to download the matching extension, then drag and drop it into the Chrome Extensions page.{' '}
      See <a href={readmeUrl} target='_blank' rel='noopener noreferrer'>installation instructions</a> for more details.
    </div>
  );
};

const StatusBanner: React.FC<{ status: Status }> = ({ status }) => {
  return (
    <div className={`status-banner ${status.type}`}>
      {'versionMismatch' in status ? (
        <VersionMismatchError
          pwMcpVersion={status.versionMismatch.pwMcpVersion}
          extensionVersion={status.versionMismatch.extensionVersion}
          downloadUrl={status.versionMismatch.downloadUrl}
        />
      ) : (
        status.message
      )}
    </div>
  );
};

// Initialize the React app
const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<ConnectApp />);
}
