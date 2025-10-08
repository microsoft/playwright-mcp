# Playwright MCP Chrome Extension

## Introduction

The Playwright MCP Chrome Extension allows you to connect to pages in your existing browser and leverage the state of your default user profile. This means the AI assistant can interact with websites where you're already logged in, using your existing cookies, sessions, and browser state, providing a seamless experience without requiring separate authentication or setup.

## Prerequisites

- Chrome/Edge/Chromium browser

## Installation Steps

### Download the Extension

Download the latest Chrome extension from GitHub:
- **Download link**: https://github.com/microsoft/playwright-mcp/releases

### Load Chrome Extension

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in the top right corner)
3. Click "Load unpacked" and select the extension directory

### Configure Playwright MCP server

Configure Playwright MCP server to connect to the browser using the extension by passing the `--extension` option when running the MCP server:

```json
{
  "mcpServers": {
    "playwright-extension": {
      "command": "npx",
      "args": [
        "@playwright/mcp@latest",
        "--extension"
      ]
    }
  }
}
```

## Usage

### Browser Tab Selection

When the LLM interacts with the browser for the first time, it will load a page where you can select which browser tab the LLM will connect to. This allows you to control which specific page the AI assistant will interact with during the session.

### Authentication Token Security ✨ NEW

The extension now includes enhanced security features for authentication tokens:

#### Token Expiration
- **Default expiration**: Tokens are valid for 30 days from creation
- **Visual indicators**: Status badges show if token is active, expiring soon (< 7 days), or expired
- **Automatic expiration**: Expired tokens must be regenerated for security

#### Token Metadata
View comprehensive token information:
- **Creation date**: When the token was generated
- **Expiration date**: When the token will expire
- **Usage tracking**: How many times the token has been used
- **Last used**: Timestamp of most recent token usage

#### Secure Copy Feature
When copying your token:
- ✅ Confirmation notification appears
- 🔒 Clipboard automatically clears after 30 seconds
- 🔔 Security notification when clipboard is cleared

This prevents token exposure if you forget to clear your clipboard manually.

#### Viewing Your Token

1. Click the extension icon in Chrome
2. Navigate to the **Status** page
3. View your token with metadata in the 🔑 Authentication Token section
4. Use the regenerate button (🔄) to create a new token anytime

#### Bypassing Connection Dialog

To skip the tab selection dialog, set the authentication token as an environment variable:

```json
{
  "mcpServers": {
    "playwright-extension": {
      "command": "npx",
      "args": [
        "@playwright/mcp@latest",
        "--extension"
      ],
      "env": {
        "PLAYWRIGHT_MCP_EXTENSION_TOKEN": "your-token-here"
      }
    }
  }
}
```

**Security Best Practices:**
- 🔄 Regenerate tokens regularly (before expiration)
- 🔒 Never share tokens in public repositories
- 🗑️ Revoke tokens immediately if compromised
- 📅 Monitor token usage and expiration dates


