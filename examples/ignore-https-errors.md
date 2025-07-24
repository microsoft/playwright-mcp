# Ignore HTTPS Errors Example

This example demonstrates how to use the `browser_ignore_https_errors` tool to configure the browser to ignore HTTPS certificate errors.

## Use Case

When testing applications that use self-signed certificates or have certificate issues during development, you may need to bypass HTTPS certificate validation.

## Basic Usage

```typescript
// Enable ignoring HTTPS errors
await mcp.callTool({
  name: 'browser_ignore_https_errors',
  arguments: {
    ignore: true
  }
});

// Now you can navigate to sites with certificate issues
await mcp.callTool({
  name: 'browser_navigate',
  arguments: {
    url: 'https://self-signed-certificate-site.com'
  }
});

// Later, if you want to re-enable certificate validation
await mcp.callTool({
  name: 'browser_ignore_https_errors',
  arguments: {
    ignore: false
  }
});
```

## Configuration via CLI

You can also set this option when starting the MCP server:

```bash
npx @playwright/mcp@latest --ignore-https-errors
```

## Important Notes

- This setting recreates the browser context with the new configuration
- All existing tabs will be closed when the context is recreated
- For security reasons, only use this in development/testing environments
- The setting persists for the current session until explicitly changed

## Equivalent Playwright Code

This tool is equivalent to creating a browser context with:

```javascript
const context = await browser.newContext({
  ignoreHTTPSErrors: true
});
``` 