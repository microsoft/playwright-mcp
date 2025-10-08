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

export interface EnhancedToken {
  token: string;
  createdAt: number;
  expiresAt: number;
  lastUsedAt?: number;
  usageCount: number;
  isRevoked: boolean;
  revokedAt?: number;
  revokedReason?: string;
}

/**
 * Validates a token and checks if it's expired or revoked
 */
export function validateToken(providedToken: string): { valid: boolean; reason?: string } {
  const tokenDataStr = localStorage.getItem('auth-token-data');
  
  if (!tokenDataStr) {
    return { valid: false, reason: 'No token found' };
  }
  
  try {
    const tokenData: EnhancedToken = JSON.parse(tokenDataStr);
    
    // Check if token matches
    if (tokenData.token !== providedToken) {
      return { valid: false, reason: 'Invalid token' };
    }
    
    // Check if revoked
    if (tokenData.isRevoked) {
      return { valid: false, reason: 'Token has been revoked' };
    }
    
    // Check if expired
    if (tokenData.expiresAt <= Date.now()) {
      return { valid: false, reason: 'Token has expired' };
    }
    
    return { valid: true };
  } catch (error) {
    return { valid: false, reason: 'Invalid token data' };
  }
}

/**
 * Tracks token usage by incrementing count and updating last used timestamp
 */
export function trackTokenUsage(token: string): void {
  const tokenDataStr = localStorage.getItem('auth-token-data');
  
  if (!tokenDataStr) {
    return;
  }
  
  try {
    const tokenData: EnhancedToken = JSON.parse(tokenDataStr);
    
    if (tokenData.token === token) {
      tokenData.usageCount++;
      tokenData.lastUsedAt = Date.now();
      localStorage.setItem('auth-token-data', JSON.stringify(tokenData));
    }
  } catch (error) {
    // Silently fail to avoid breaking functionality
    console.error('Failed to track token usage:', error);
  }
}

/**
 * Gets token metadata for display purposes
 */
export function getTokenMetadata(token: string): EnhancedToken | null {
  const tokenDataStr = localStorage.getItem('auth-token-data');
  
  if (!tokenDataStr) {
    return null;
  }
  
  try {
    const tokenData: EnhancedToken = JSON.parse(tokenDataStr);
    if (tokenData.token === token) {
      return tokenData;
    }
    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Revokes a token with a reason
 */
export function revokeToken(token: string, reason: string): boolean {
  const tokenDataStr = localStorage.getItem('auth-token-data');
  
  if (!tokenDataStr) {
    return false;
  }
  
  try {
    const tokenData: EnhancedToken = JSON.parse(tokenDataStr);
    
    if (tokenData.token === token) {
      tokenData.isRevoked = true;
      tokenData.revokedAt = Date.now();
      tokenData.revokedReason = reason;
      localStorage.setItem('auth-token-data', JSON.stringify(tokenData));
      
      // Save to revoked tokens history
      saveToRevokedHistory(tokenData);
      
      return true;
    }
    return false;
  } catch (error) {
    console.error('Failed to revoke token:', error);
    return false;
  }
}

/**
 * Saves revoked token to history (max 10 items, auto-cleanup after 90 days)
 */
function saveToRevokedHistory(tokenData: EnhancedToken): void {
  const historyStr = localStorage.getItem('revoked-tokens-history');
  let history: EnhancedToken[] = [];
  
  if (historyStr) {
    try {
      history = JSON.parse(historyStr);
    } catch (error) {
      history = [];
    }
  }
  
  // Add new revoked token
  history.push(tokenData);
  
  // Cleanup old tokens (> 90 days)
  const ninetyDaysAgo = Date.now() - (90 * 24 * 60 * 60 * 1000);
  history = history.filter(t => (t.revokedAt || 0) > ninetyDaysAgo);
  
  // Keep only last 10
  if (history.length > 10) {
    history = history.slice(-10);
  }
  
  localStorage.setItem('revoked-tokens-history', JSON.stringify(history));
}

/**
 * Gets revoked tokens history
 */
export function getRevokedTokensHistory(): EnhancedToken[] {
  const historyStr = localStorage.getItem('revoked-tokens-history');
  
  if (!historyStr) {
    return [];
  }
  
  try {
    return JSON.parse(historyStr);
  } catch (error) {
    return [];
  }
}
