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

import React, { useCallback, useState, useEffect } from 'react';
import { CopyToClipboard } from './copyToClipboard';
import * as icons from './icons';
import './authToken.css';

interface EnhancedToken {
  token: string;
  createdAt: number;
  expiresAt: number;
  lastUsedAt?: number;
  usageCount: number;
  isRevoked: boolean;
  revokedAt?: number;
  revokedReason?: string;
}

const DEFAULT_TOKEN_EXPIRATION_DAYS = 30;
const CLIPBOARD_CLEAR_TIMEOUT_MS = 30000;
const EXPIRING_SOON_THRESHOLD_DAYS = 7;

export const AuthTokenSection: React.FC<{}> = ({}) => {
  const [tokenData, setTokenData] = useState<EnhancedToken>(getOrCreateEnhancedToken);
  const [isExampleExpanded, setIsExampleExpanded] = useState<boolean>(false);
  const [copyNotification, setCopyNotification] = useState<string>('');
  const [timeRemaining, setTimeRemaining] = useState<string>('');

  // Update time remaining display
  useEffect(() => {
    const updateTimeRemaining = () => {
      const now = Date.now();
      const remaining = tokenData.expiresAt - now;
      
      if (remaining <= 0) {
        setTimeRemaining('Expired');
        return;
      }
      
      const days = Math.floor(remaining / (1000 * 60 * 60 * 24));
      const hours = Math.floor((remaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      
      if (days > 0) {
        setTimeRemaining(`${days} day${days > 1 ? 's' : ''}`);
      } else if (hours > 0) {
        setTimeRemaining(`${hours} hour${hours > 1 ? 's' : ''}`);
      } else {
        const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
        setTimeRemaining(`${minutes} minute${minutes > 1 ? 's' : ''}`);
      }
    };
    
    updateTimeRemaining();
    const interval = setInterval(updateTimeRemaining, 60000); // Update every minute
    
    return () => clearInterval(interval);
  }, [tokenData.expiresAt]);

  const onRegenerateToken = useCallback(() => {
    const newTokenData = generateEnhancedToken();
    localStorage.setItem('auth-token-data', JSON.stringify(newTokenData));
    setTokenData(newTokenData);
    setCopyNotification('');
  }, []);

  const onSecureCopy = useCallback(async () => {
    const tokenCode = authTokenCode(tokenData.token);
    try {
      await navigator.clipboard.writeText(tokenCode);
      setCopyNotification('✓ Copied! Clipboard will clear in 30s');
      
      // Auto-clear clipboard after 30 seconds
      setTimeout(async () => {
        try {
          const current = await navigator.clipboard.readText();
          if (current === tokenCode) {
            await navigator.clipboard.writeText('');
            setCopyNotification('🔒 Clipboard cleared for security');
            setTimeout(() => setCopyNotification(''), 3000);
          }
        } catch (error) {
          // Ignore errors if clipboard access is denied
        }
      }, CLIPBOARD_CLEAR_TIMEOUT_MS);
      
      // Clear notification after 3 seconds
      setTimeout(() => {
        if (copyNotification.includes('Copied')) {
          setCopyNotification('');
        }
      }, 3000);
    } catch (error) {
      setCopyNotification('❌ Failed to copy');
      setTimeout(() => setCopyNotification(''), 3000);
    }
  }, [tokenData.token, copyNotification]);

  const toggleExample = useCallback(() => {
    setIsExampleExpanded(!isExampleExpanded);
  }, [isExampleExpanded]);

  const getTokenStatus = (): 'active' | 'expiring' | 'expired' => {
    const now = Date.now();
    const remaining = tokenData.expiresAt - now;
    
    if (remaining <= 0) return 'expired';
    
    const daysRemaining = remaining / (1000 * 60 * 60 * 24);
    if (daysRemaining <= EXPIRING_SOON_THRESHOLD_DAYS) return 'expiring';
    
    return 'active';
  };

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const tokenStatus = getTokenStatus();

  return (
    <div className='auth-token-section'>
      <div className='auth-token-header'>
        <div className='auth-token-title'>
          🔑 Authentication Token
          <span className={`auth-token-status-badge auth-token-status-${tokenStatus}`}>
            {tokenStatus === 'active' && '🟢 Active'}
            {tokenStatus === 'expiring' && '🟡 Expiring Soon'}
            {tokenStatus === 'expired' && '🔴 Expired'}
          </span>
        </div>
      </div>

      {tokenStatus === 'expired' && (
        <div className='auth-token-warning expired'>
          ⚠️ This token has expired. Please regenerate a new token to continue.
        </div>
      )}

      {tokenStatus === 'expiring' && (
        <div className='auth-token-warning expiring'>
          ⚠️ This token will expire soon. Consider regenerating it.
        </div>
      )}

      <div className='auth-token-description'>
        Set this environment variable to bypass the connection dialog:
      </div>
      <div className='auth-token-container'>
        <code className='auth-token-code'>{authTokenCode(tokenData.token)}</code>
        <button className='auth-token-refresh' title='Generate new token' aria-label='Generate new token' onClick={onRegenerateToken}>{icons.refresh()}</button>
        <CopyToClipboard value={authTokenCode(tokenData.token)} />
      </div>

      {copyNotification && (
        <div className='auth-token-copy-notification'>
          {copyNotification}
        </div>
      )}

      <div className='auth-token-metadata'>
        <div className='auth-token-metadata-row'>
          <span className='auth-token-metadata-label'>Created:</span>
          <span className='auth-token-metadata-value'>{formatDate(tokenData.createdAt)}</span>
        </div>
        <div className='auth-token-metadata-row'>
          <span className='auth-token-metadata-label'>Expires:</span>
          <span className='auth-token-metadata-value'>
            {formatDate(tokenData.expiresAt)} 
            <span className='auth-token-time-remaining'>({timeRemaining} remaining)</span>
          </span>
        </div>
        <div className='auth-token-metadata-row'>
          <span className='auth-token-metadata-label'>Usage:</span>
          <span className='auth-token-metadata-value'>
            {tokenData.usageCount} time{tokenData.usageCount !== 1 ? 's' : ''}
            {tokenData.lastUsedAt && (
              <span className='auth-token-last-used'> • Last used {getRelativeTime(tokenData.lastUsedAt)}</span>
            )}
          </span>
        </div>
      </div>

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
              <code className='auth-token-example-code'>{exampleConfig(tokenData.token)}</code>
              <CopyToClipboard value={exampleConfig(tokenData.token)} />
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

function generateEnhancedToken(): EnhancedToken {
  const now = Date.now();
  const expiresAt = now + (DEFAULT_TOKEN_EXPIRATION_DAYS * 24 * 60 * 60 * 1000);
  
  return {
    token: generateAuthToken(),
    createdAt: now,
    expiresAt: expiresAt,
    usageCount: 0,
    isRevoked: false,
  };
}

function getRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  
  if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  return 'just now';
}

export const getOrCreateEnhancedToken = (): EnhancedToken => {
  // Try to get enhanced token data
  const tokenDataStr = localStorage.getItem('auth-token-data');
  if (tokenDataStr) {
    try {
      const tokenData = JSON.parse(tokenDataStr) as EnhancedToken;
      // Check if token is expired
      if (tokenData.expiresAt > Date.now() && !tokenData.isRevoked) {
        return tokenData;
      }
    } catch (error) {
      // Invalid data, will regenerate
    }
  }
  
  // Migrate old token if exists
  const oldToken = localStorage.getItem('auth-token');
  if (oldToken) {
    const now = Date.now();
    const tokenData: EnhancedToken = {
      token: oldToken,
      createdAt: now,
      expiresAt: now + (DEFAULT_TOKEN_EXPIRATION_DAYS * 24 * 60 * 60 * 1000),
      usageCount: 0,
      isRevoked: false,
    };
    localStorage.setItem('auth-token-data', JSON.stringify(tokenData));
    localStorage.removeItem('auth-token'); // Remove old format
    return tokenData;
  }
  
  // Generate new token
  const newTokenData = generateEnhancedToken();
  localStorage.setItem('auth-token-data', JSON.stringify(newTokenData));
  return newTokenData;
};

// Backward compatibility - export a function that returns just the token string
export const getOrCreateAuthToken = (): string => {
  return getOrCreateEnhancedToken().token;
};
