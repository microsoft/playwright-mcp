// @ts-check

/**
 * @typedef {{tabId: number}} DebuggerTarget
 */

function debugLog(...args) {
  const enabled = true;
  if (enabled) {
    console.log(...args);
  }
}

class Extension {
  constructor() {
    chrome.tabs.onUpdated.addListener((this.onTabsUpdated.bind(this)));
    this.adapters = /** @type {Map<number, CDPAdapter>} */ (new Map());
  }

  /**
   * @param {number} tabId 
   * @param {chrome.tabs.TabChangeInfo} changeInfo 
   * @param {chrome.tabs.Tab} tab 
   */
  async onTabsUpdated(tabId, changeInfo, tab) {
    if (changeInfo.status !== 'complete' || !tab.url)
      return;
    const url = new URL(tab.url);
    if (url.hostname !== 'demo.playwright.dev' || url.pathname !== '/mcp.html')
      return;
    const params = new URLSearchParams(url.search);
    const proxyURL = params.get('connectionURL');
    if (!proxyURL)
      return;
    if (this.adapters.has(tabId)) {
      debugLog(`Already attached to tab: ${tabId}`);
      return;
    }
    debugLog(`Attaching debugger to tab: ${tabId}`);
    {
      // Ask for user approval
      await chrome.tabs.update(tabId, { url: chrome.runtime.getURL('prompt.html') });
      await new Promise((resolve) => {
        const listener = (message, foo) => {
          if (foo.tab.id === tabId && message.action === 'approve') {
            chrome.runtime.onMessage.removeListener(listener);
            resolve(undefined);
          }
        };
        chrome.runtime.onMessage.addListener(listener);
      });
    }
    const debuggee = { tabId }
    await chrome.debugger.attach(debuggee, '1.3')
    if (chrome.runtime.lastError) {
      debugLog('Failed to attach debugger:', chrome.runtime.lastError.message);
      return;
    }
    debugLog('Debugger attached to tab:', debuggee.tabId);
    const { targetId, browserContextId } = (/** @type{any} */ (await chrome.debugger.sendCommand(debuggee, 'Target.getTargetInfo', {}))).targetInfo;
    const socket = new WebSocket(proxyURL);
    const adapter = new CDPAdapter(tabId);
    adapter.dispatch = (data) => {
      debugLog('Sending message to browser:', data);
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(data));
      } else {
        debugLog('WebSocket is not open. Cannot send data.');
      }
    }
    adapter.onClose = async () => {
      debugLog('Debugger detached from tab:', tabId);
      this.adapters.delete(tabId);
      if (socket.readyState === WebSocket.OPEN)
        socket.close();
    }
    socket.addEventListener('open', () => {
      chrome.tabs.update(debuggee.tabId, { url: chrome.runtime.getURL('success.html') });
    });
    socket.addEventListener('message', (e) => adapter.onBrowserMessage(targetId, browserContextId, e));
    socket.addEventListener('error', (event) => {
      debugLog('WebSocket error:', event);
      adapter.detach();
    });
    socket.addEventListener('close', async () => {
      adapter.detach();
    });
    this.adapters.set(tabId, adapter);
  }
}

class CDPAdapter {
  /**
   * @param {number} tabId
   */
  constructor(tabId) {
    chrome.debugger.onEvent.addListener((this._onDebuggerEvent.bind(this)));
    chrome.debugger.onDetach.addListener(this._onDebuggerDetach.bind(this));
    this.onClose = () => { }
    this.dispatch = (data) => { }
    this._debuggee = { tabId };
  }

  /**
   * @param {string} targetId 
   * @param {string} browserContextId 
   * @param {object} event 
   * @returns 
   */
  async onBrowserMessage(targetId, browserContextId, event) {
    try {
      const message = JSON.parse(await event.data.text());
      if (message.method === 'Browser.getVersion') {
        // Handle the Browser.getVersion command
        let versionInfo = {
          protocolVersion: '1.3',
          userAgent: navigator.userAgent,
          product: 'Chrome'
        };
        this.dispatch({ id: message.id, result: versionInfo });
        return;
      }
      if (message.method === 'Target.setAutoAttach' && !message.sessionId) {
        this.dispatch({
          method: 'Target.attachedToTarget',
          params: {
            sessionId: 'dummy-session-id',
            targetInfo: {
              targetId,
              browserContextId,
              type: 'page',
              title: '',
              url: 'data:text/html,',
              attached: true,
              canAccessOpener: false,
            },
            waitingForDebugger: false
          }
        })
        this.dispatch({ id: message.id, result: {} });
        return;
      }
      if (message.method === 'Browser.setDownloadBehavior') {
        this.dispatch({ id: message.id, result: {} });
        return;
      }
      if (message.method) {
        debugLog('Received command from WebSocket:', message);
        chrome.debugger.sendCommand(this._debuggee, message.method, message.params).then(response => {
          // Send back the response to the WebSocket server.
          let reply = {
            id: message.id,  // echo back the command id if provided
            result: response,
            error: chrome.runtime.lastError ? chrome.runtime.lastError.message : null,
            sessionId: message.sessionId
          };
          this.dispatch(reply);
        });
      }
    } catch (e) {
      debugLog('Error processing WebSocket message:', e);
    }
  }

  /**
   * @param {chrome.debugger.DebuggerSession} source 
   * @param {string} method 
   * @param {Object} params 
   */
  _onDebuggerEvent(source, method, params) {
    debugLog('CDP event:', method, params);
    let eventData = {
      method: method,
      params: params,
      sessionId: 'dummy-session-id', // Use a dummy session ID for now
    };
    this.dispatch(eventData);
  }

  /**
   * @param {chrome.debugger.DetachReason} reason
   */
  _onDebuggerDetach(reason) {
    debugLog(`Debugger detached from tab: ${this._debuggee.tabId} with reason: ${reason}`);
    this.onClose();
  }

  async detach() {
    await chrome.debugger.detach(this._debuggee);
    chrome.debugger.onEvent.removeListener(this._onDebuggerEvent.bind(this));
    chrome.debugger.onDetach.removeListener(this._onDebuggerDetach.bind(this));
    this.onClose();
  }
}

new Extension();
