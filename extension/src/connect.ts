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

interface TabInfo {
  id: number;
  windowId: number;
  title: string;
  url: string;
  favIconUrl?: string;
}

class ConnectPage {
  private _tabList: HTMLElement;
  private _tabListContainer: HTMLElement;
  private _statusContainer: HTMLElement;
  private _selectedTab: TabInfo | undefined;

  constructor() {
    this._tabList = document.getElementById('tab-list')!;
    this._tabListContainer = document.getElementById('tab-list-container')!;
    this._statusContainer = document.getElementById('status-container') as HTMLElement;
    this._addButtonHandlers();
    void this._loadTabs();
  }

  private _addButtonHandlers() {
    const continueBtn = document.getElementById('continue-btn') as HTMLButtonElement;
    const rejectBtn = document.getElementById('reject-btn') as HTMLButtonElement;
    const buttonRow = document.querySelector('.button-row') as HTMLElement;

    const params = new URLSearchParams(window.location.search);
    const mcpRelayUrl = params.get('mcpRelayUrl');

    if (!mcpRelayUrl) {
      buttonRow.style.display = 'none';
      this._showStatus('error', 'Missing mcpRelayUrl parameter in URL.');
      return;
    }

    let clientInfo = 'unknown';
    try {
      const client = JSON.parse(params.get('client') || '{}');
      clientInfo = `${client.name}/${client.version}`;
    } catch (e) {
      this._showStatus('error', 'Failed to parse client version.');
      return;
    }

    this._showStatus('connecting', `MCP client "${clientInfo}" is trying to connect. Do you want to continue?`);

    rejectBtn.addEventListener('click', async () => {
      buttonRow.style.display = 'none';
      this._tabListContainer.style.display = 'none';
      this._showStatus('error', 'Connection rejected. This tab can be closed.');
    });

    continueBtn.addEventListener('click', async () => {
      buttonRow.style.display = 'none';
      this._tabListContainer.style.display = 'none';
      try {
        const selectedTab = this._selectedTab;
        if (!selectedTab) {
          this._showStatus('error', 'Tab not selected.');
          return;
        }
        const response = await chrome.runtime.sendMessage({
          type: 'connectToMCPRelay',
          mcpRelayUrl,
          tabId: selectedTab.id,
          windowId: selectedTab.windowId,
        });
        if (response?.success)
          this._showStatus('connected', `MCP client "${clientInfo}" connected.`);
        else
          this._showStatus('error', response?.error || `MCP client "${clientInfo}" failed to connect.`);
      } catch (e) {
        this._showStatus('error', `MCP client "${clientInfo}" failed to connect: ${e}`);
      }
    });
  }

  private async _loadTabs(): Promise<void> {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'getTabs' });
      if (response.success)
        this._populateTabList(response.tabs, response.currentTabId);
      else
        this._showStatus('error', 'Failed to load tabs: ' + response.error);
    } catch (error) {
      this._showStatus('error', 'Failed to communicate with background script: ' + error);
    }
  }

  private _populateTabList(tabs: TabInfo[], currentTabId: number): void {
    this._tabList.replaceChildren();
    this._selectedTab = tabs.find(tab => tab.id === currentTabId);

    tabs.forEach((tab, index) => {
      const tabElement = this._createTabElement(tab);
      this._tabList.appendChild(tabElement);
    });
  }

  private _createTabElement(tab: TabInfo): HTMLElement {
    const disabled = tab.url.startsWith('chrome://');

    const tabInfoDiv = document.createElement('div');
    tabInfoDiv.className = 'tab-info';
    tabInfoDiv.style.padding = '5px';
    if (disabled)
      tabInfoDiv.style.opacity = '0.5';

    const radioButton = document.createElement('input');
    radioButton.type = 'radio';
    radioButton.name = 'tab-selection';
    radioButton.checked = tab.id === this._selectedTab?.id;
    radioButton.id = `tab-${tab.id}`;
    radioButton.addEventListener('change', e => {
      if (radioButton.checked)
        this._selectedTab = tab;
    });
    if (disabled)
      radioButton.disabled = true;

    const favicon = document.createElement('img');
    favicon.className = 'tab-favicon';
    if (tab.favIconUrl)
      favicon.src = tab.favIconUrl;
    favicon.alt = '';
    favicon.style.height = '16px';
    favicon.style.width = '16px';

    const title = document.createElement('span');
    title.style.paddingLeft = '5px';
    title.className = 'tab-title';
    title.textContent = tab.title || 'Untitled';

    const url = document.createElement('span');
    url.style.paddingLeft = '5px';
    url.className = 'tab-url';
    url.textContent = tab.url;

    tabInfoDiv.appendChild(radioButton);
    tabInfoDiv.appendChild(favicon);
    tabInfoDiv.appendChild(title);
    tabInfoDiv.appendChild(url);

    return tabInfoDiv;
  }

  private _showStatus(type: 'connected' | 'error' | 'connecting', message: string) {
    const div = document.createElement('div');
    div.className = `status ${type}`;
    div.textContent = message;
    this._statusContainer.replaceChildren(div);
  }
}

new ConnectPage();
