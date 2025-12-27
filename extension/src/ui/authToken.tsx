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

import React, { useCallback, useState } from 'react';
import { CopyToClipboard } from './copyToClipboard';
import * as icons from './icons';
import './authToken.css';

export const AuthTokenSection: React.FC<{}> = ({ }) => {
  const [authToken, setAuthToken] = useState<string>(getOrCreateAuthToken);
  const [isExampleExpanded, setIsExampleExpanded] = useState<boolean>(false);
  const [isCustomTokenMode, setIsCustomTokenMode] = useState<boolean>(false);
  const [customTokenInput, setCustomTokenInput] = useState<string>('');
  const [customTokenError, setCustomTokenError] = useState<string>('');

  const onRegenerateToken = useCallback(() => {
    const newToken = generateAuthToken();
    saveAuthToken(newToken);
    setAuthToken(newToken);
    setIsCustomTokenMode(false);
    setCustomTokenError('');
  }, []);

  const onSetCustomToken = useCallback(() => {
    // Validate: must be at least 16 characters for security
    if (customTokenInput.length < 16) {
      setCustomTokenError('Token must be at least 16 characters');
      return;
    }
    // Validate: only alphanumeric and URL-safe characters
    if (!/^[a-zA-Z0-9_-]+$/.test(customTokenInput)) {
      setCustomTokenError('Token can only contain letters, numbers, - and _');
      return;
    }

    setCustomTokenError('');
    saveAuthToken(customTokenInput);
    setAuthToken(customTokenInput);
    setIsCustomTokenMode(false);
    setCustomTokenInput('');
  }, [customTokenInput]);

  const toggleExample = useCallback(() => {
    setIsExampleExpanded(!isExampleExpanded);
  }, [isExampleExpanded]);

  const toggleCustomTokenMode = useCallback(() => {
    setIsCustomTokenMode(!isCustomTokenMode);
    setCustomTokenInput('');
    setCustomTokenError('');
  }, [isCustomTokenMode]);

  return (
    <div className='auth-token-section'>
      <div className='auth-token-description'>
        Set this environment variable to bypass the connection dialog:
      </div>
      <div className='auth-token-container'>
        <code className='auth-token-code'>{authTokenCode(authToken)}</code>
        <button
          className='auth-token-refresh'
          title='Generate new random token'
          aria-label='Generate new random token'
          onClick={onRegenerateToken}
        >
          {icons.refresh()}
        </button>
        <CopyToClipboard value={authTokenCode(authToken)} />
      </div>

      {/* Custom Token Section */}
      <div className='auth-token-custom-section'>
        <button
          className='auth-token-custom-toggle'
          onClick={toggleCustomTokenMode}
          aria-expanded={isCustomTokenMode}
          title={isCustomTokenMode ? 'Hide custom token input' : 'Set a custom token'}
        >
          <span className={`auth-token-chevron ${isCustomTokenMode ? 'expanded' : ''}`}>
            {icons.chevronDown()}
          </span>
          Set custom token (for automation)
        </button>

        {isCustomTokenMode && (
          <div className='auth-token-custom-content'>
            <div className='auth-token-custom-description'>
              Set a constant token for automated pipelines. Token must be at least 16 characters
              and contain only letters, numbers, hyphens, and underscores.
            </div>
            <div className='auth-token-custom-input-container'>
              <input
                type='text'
                className='auth-token-custom-input'
                placeholder='Enter custom token...'
                value={customTokenInput}
                onChange={(e) => {
                  setCustomTokenInput(e.target.value);
                  setCustomTokenError('');
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter')
                    onSetCustomToken();
                }}
                aria-label='Custom token input'
              />
              <button
                className='auth-token-custom-save'
                onClick={onSetCustomToken}
              >
                Save
              </button>
            </div>
            {customTokenError && (
              <div className='auth-token-custom-error'>{customTokenError}</div>
            )}
          </div>
        )}
      </div>

      {/* Example Config Section */}
      <div className='auth-token-example-section'>
        <button
          className='auth-token-example-toggle'
          onClick={toggleExample}
          aria-expanded={isExampleExpanded}
          title={isExampleExpanded ? 'Hide example config' : 'Show example config'}
        >
          <span className={`auth-token-chevron ${isExampleExpanded ? 'expanded' : ''}`}>
            {icons.chevronDown()}
          </span>
          Example MCP server configuration
        </button>

        {isExampleExpanded && (
          <div className='auth-token-example-content'>
            <div className='auth-token-example-description'>
              Add this configuration to your MCP client (e.g., VS Code) to connect to the Playwright MCP Bridge:
            </div>
            <div className='auth-token-example-config'>
              <code className='auth-token-example-code'>{exampleConfig(authToken)}</code>
              <CopyToClipboard value={exampleConfig(authToken)} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

function authTokenCode(authToken: string) {
  return `PLAYWRIGHT_MCP_EXTENSION_TOKEN=${authToken}`;
}

function exampleConfig(authToken: string) {
  return `{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["@playwright/mcp@latest", "--extension"],
      "env": {
        "PLAYWRIGHT_MCP_EXTENSION_TOKEN":
          "${authToken}"
      }
    }
  }
}`;
}

function generateAuthToken(): string {
  // Generate a cryptographically secure random token
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  // Convert to base64 and make it URL-safe
  return btoa(String.fromCharCode.apply(null, Array.from(array)))
    .replace(/[+/=]/g, match => {
      switch (match) {
        case '+': return '-';
        case '/': return '_';
        case '=': return '';
        default: return match;
      }
    });
}

function saveAuthToken(token: string): void {
  localStorage.setItem('auth-token', token);
}

export const getOrCreateAuthToken = (): string => {
  let token = localStorage.getItem('auth-token');
  if (!token) {
    token = generateAuthToken();
    localStorage.setItem('auth-token', token);
  }
  return token;
}
