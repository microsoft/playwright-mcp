# Testing the Network Details Feature Locally

## Quick Start

### Option 1: Test with Claude Desktop (Recommended)

1. **Update your Claude Desktop MCP configuration**

   Edit your Claude config file:
   - Windows: `%APPDATA%\Claude\claude_desktop_config.json`
   - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`

   Add or update the playwright-mcp server to point to your local directory:

   ```json
   {
     "mcpServers": {
       "playwright": {
         "command": "node",
         "args": ["H:\\GitHub\\playwright-mcp\\cli.js"]
       }
     }
   }
   ```

2. **Restart Claude Desktop**

3. **Test the new tools**:
   - Ask Claude: "Navigate to https://jsonplaceholder.typicode.com/users and show me the network requests"
   - You should see output like: `[a1b2c3d4] [GET] https://jsonplaceholder.typicode.com/users => [200] OK`
   - Then ask: "Show me the details for request a1b2c3d4"
   - You'll see full headers, response body, timing info, etc.

### Option 2: Test with MCP Inspector (CLI Testing)

1. **Install the MCP Inspector**:
   ```bash
   npx @modelcontextprotocol/inspector node cli.js
   ```

2. **This will open a web interface** where you can:
   - See all available tools (including `browser_network_request_details`)
   - Call tools manually with parameters
   - Inspect responses

3. **Test workflow**:
   - Call `browser_navigate` with url: "https://example.com"
   - Call `browser_network_requests` - note the IDs in brackets
   - Call `browser_network_request_details` with a requestId
   - Verify the detailed JSON response

### Option 3: Automated Test

Run the existing test suite:
```bash
npm test
```

Or run a specific test:
```bash
npm test -- tests/capabilities.spec.ts
```

## Manual Testing Workflow

### 1. Start the MCP server
```bash
node cli.js
```

### 2. In another terminal, use the MCP SDK to connect

Create a test script `test-network.js`:

```javascript
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');

async function test() {
  const transport = new StdioClientTransport({
    command: 'node',
    args: ['cli.js']
  });

  const client = new Client({
    name: 'test-client',
    version: '1.0.0'
  }, {
    capabilities: {}
  });

  await client.connect(transport);

  // List tools
  const { tools } = await client.listTools();
  console.log('Available tools:', tools.map(t => t.name));

  // Navigate to a page
  await client.callTool('browser_navigate', { url: 'https://example.com' });

  // Get network requests
  const requests = await client.callTool('browser_network_requests', {});
  console.log('Network requests:', requests);

  // Extract first request ID (format: [a1b2c3d4])
  const match = requests.content[0].text.match(/\[([a-f0-9]{8})\]/);
  if (match) {
    const requestId = match[1];
    console.log('Testing request ID:', requestId);

    // Get request details
    const details = await client.callTool('browser_network_request_details', {
      requestId
    });
    console.log('Request details:', details);
  }

  await client.close();
}

test().catch(console.error);
```

Run it:
```bash
node test-network.js
```

## What to Test

### ✅ Basic Functionality
- [ ] Navigate to a page and list requests - IDs should appear
- [ ] Call details with a valid ID - should return JSON
- [ ] Call details with invalid ID - should return error message

### ✅ Response Body Handling
- [ ] Text response (HTML) - should show full text
- [ ] JSON response - should show formatted JSON
- [ ] Binary response (image) - should show `<binary data, X bytes>`
- [ ] Large response (>100KB) - should show truncation message

### ✅ Headers
- [ ] Request headers should be visible
- [ ] Response headers should be visible
- [ ] Sensitive headers (Authorization, Cookie) are shown for debugging

### ✅ Timing Information
- [ ] Timing object should have DNS, connect, response times
- [ ] All values should be reasonable (not -1 or null)

### ✅ Failed Requests
- [ ] 404 responses should show error details
- [ ] Failed requests should show failure.errorText
- [ ] CORS errors should be captured

## Expected Output Format

### browser_network_requests (modified)
```
[a1b2c3d4] [GET] https://example.com => [200] OK
[b2c3d4e5] [GET] https://example.com/style.css => [200] OK
[c3d4e5f6] [GET] https://example.com/logo.png => [200] OK
```

### browser_network_request_details
```json
{
  "request": {
    "id": "a1b2c3d4",
    "url": "https://example.com",
    "method": "GET",
    "headers": {
      "accept": "text/html,application/xhtml+xml...",
      "user-agent": "Mozilla/5.0..."
    },
    "postData": null,
    "resourceType": "document"
  },
  "response": {
    "url": "https://example.com",
    "status": 200,
    "statusText": "OK",
    "headers": {
      "content-type": "text/html; charset=UTF-8",
      "cache-control": "max-age=3600"
    },
    "body": "<!DOCTYPE html>\n<html>...",
    "bodySize": 1256
  },
  "timing": {
    "startTime": 1699564800000,
    "domainLookupStart": 0.5,
    "domainLookupEnd": 2.3,
    "connectStart": 2.3,
    "connectEnd": 15.8,
    "requestStart": 15.9,
    "responseStart": 125.4,
    "responseEnd": 130.2
  }
}
```

## Troubleshooting

### "Request with ID xxx not found"
- Make sure you're using the ID from the current page session
- IDs are from the current page's requests only
- Navigate to a new page to get fresh requests

### "Patch not applied"
- Run `npm install` to trigger the postinstall script
- Or manually run `npx patch-package`
- Check that `patches/playwright+1.57.0-alpha-1761929702000.patch` exists

### Tools not showing up
- Restart Claude Desktop completely
- Check the config file path is correct
- Look at Claude Desktop logs (Help > Show Logs)

### Body shows "<unable to fetch body>"
- Some requests don't allow body access
- Response may have been consumed by the page
- This is normal for some resource types

## Next Steps After Testing

Once you've verified everything works:

1. **Consider contributing upstream**: Create a PR to the Playwright repository with this feature
2. **Document use cases**: Add examples to README.md
3. **Share with community**: This could be useful for debugging API integrations
