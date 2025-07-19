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

document.addEventListener('DOMContentLoaded', async () => {
  const statusContainer = document.getElementById('status-container') as HTMLElement;
  const continueBtn = document.getElementById('continue-btn') as HTMLButtonElement;
  const rejectBtn = document.getElementById('reject-btn') as HTMLButtonElement;
  const buttonRow = document.querySelector('.button-row') as HTMLElement;

  function showStatus(type: 'connected' | 'error' | 'connecting', message: string) {
    const div = document.createElement('div');
    div.className = `status ${type}`;
    div.textContent = message;
    statusContainer.replaceChildren(div);
  }

  const params = new URLSearchParams(window.location.search);
  const mcpRelayUrl = params.get('mcpRelayUrl');

  if (!mcpRelayUrl) {
    buttonRow.style.display = 'none';
    showStatus('error', 'Missing mcpRelayUrl parameter in URL.');
    return;
  }

  let clientInfo = 'unknown';
  try {
    const client = JSON.parse(params.get('client') || '{}');
    clientInfo = `${client.name}/${client.version}`;
  } catch (e) {
    showStatus('error', 'Failed to parse client version.');
    return;
  }

  showStatus('connecting', `MCP client "${clientInfo}" is trying to connect. Do you want to continue?`);

  rejectBtn.addEventListener('click', async () => {
    buttonRow.style.display = 'none';
    showStatus('error', 'Connection rejected. This tab can be closed.');
  });

  continueBtn.addEventListener('click', async () => {
    buttonRow.style.display = 'none';
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'connectToMCPRelay',
        mcpRelayUrl
      });
      if (response?.success)
        showStatus('connected', `MCP client "${clientInfo}" connected.`);
      else
        showStatus('error', response?.error || `MCP client "${clientInfo}" failed to connect.`);
    } catch (e) {
      showStatus('error', `MCP client "${clientInfo}" failed to connect: ${e}`);
    }
  });
});
