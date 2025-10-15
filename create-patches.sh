#!/bin/bash

# RTL Playwright MCP Patch Script
# This applies our session management fixes to the playwright-mcp source

set -e

echo "🔧 Applying RTL Custom Patches to Playwright MCP"
echo "==============================================="

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -f "cli.js" ]; then
    echo "❌ Error: Must be run from playwright-mcp root directory"
    exit 1
fi

# Create patches directory
mkdir -p patches

echo "📝 Creating patches for our fixes..."

# Patch 1: Fix streamable-http session management
cat > patches/streamable-http-session-fix.patch << 'EOF'
--- a/packages/playwright/src/mcp/sdk/http.ts
+++ b/packages/playwright/src/mcp/sdk/http.ts
@@ -160,12 +160,9 @@ async function handleStreamable(serverBackendFactory: ServerBackendFactory, req
       }
     });
 
-    transport.onclose = () => {
-      if (!transport.sessionId)
-        return;
-      sessions.delete(transport.sessionId);
-      testDebug(`delete http session: ${transport.sessionId}`);
-    };
+    // Don't set onclose handler to prevent premature session deletion
+    // Sessions will be cleaned up by the server shutdown or explicit cleanup
+    // This fixes the "Session not found" issue by keeping sessions alive longer
 
     await transport.handleRequest(req, res);
     return;
EOF

# Patch 2: Add --transport option
cat > patches/transport-option.patch << 'EOF'
--- a/packages/playwright/src/mcp/program.ts
+++ b/packages/playwright/src/mcp/program.ts
@@ -50,6 +50,7 @@ export function decorateCommand(command: Command, version: string) {
       .option('--secrets <path>', 'path to a file containing secrets in the dotenv format', dotenvFileLoader)
-      .option('--shared-browser-context', 'reuse the same browser context between all connected HTTP clients.')
+      .option('--shared-browser-context', 'reuse the same browser context between all connected HTTP clients. WARNING: This can cause state pollution between different sessions and is not recommended for production use.')
+      .option('--transport <transport>', 'transport protocol to use, possible values: sse, streamable-http. Defaults to streamable-http.')
       .option('--storage-state <path>', 'path to the storage state file for isolated sessions.')
       .option('--test-id-attribute <attribute>', 'specify the attribute to use for test ids, defaults to "data-testid"')
       .option('--timeout-action <timeout>', 'specify action timeout in milliseconds, defaults to 5000ms', numberParser)
EOF

# Patch 3: Browser context isolation
cat > patches/browser-context-isolation.patch << 'EOF'
--- a/packages/playwright/src/mcp/browser/browserContextFactory.ts
+++ b/packages/playwright/src/mcp/browser/browserContextFactory.ts
@@ -234,7 +234,10 @@ class PersistentContextFactory implements BrowserContextFactory {
   private async _createUserDataDir(clientInfo: ClientInfo) {
     const dir = process.env.PWMCP_PROFILES_DIR_FOR_TEST ?? registryDirectory;
     const browserToken = this.config.browser.launchOptions?.channel ?? this.config.browser?.browserName;
     // Hesitant putting hundreds of files into the user's workspace, so using it for hashing instead.
     const rootPath = firstRootPath(clientInfo);
     const rootPathToken = rootPath ? `-${createHash(rootPath)}` : '';
-    const result = path.join(dir, `mcp-${browserToken}${rootPathToken}`);
+    // Add session-specific identifier to ensure isolation between different MCP sessions
+    // This prevents state pollution when multiple clients connect with the same name/version
+    const sessionId = crypto.randomUUID();
+    const result = path.join(dir, `mcp-${browserToken}${rootPathToken}-${sessionId}`);
     await fs.promises.mkdir(result, { recursive: true });
     return result;
   }
EOF

echo "✅ Patches created successfully!"
echo ""
echo "📋 Patches created:"
echo "   📄 patches/streamable-http-session-fix.patch"
echo "   📄 patches/transport-option.patch" 
echo "   📄 patches/browser-context-isolation.patch"
echo ""
echo "🎯 These patches fix:"
echo "   ✅ Streamable-HTTP session management (prevents 'Session not found' errors)"
echo "   ✅ Browser context isolation (prevents state pollution between sessions)"
echo "   ✅ Transport option support (allows choosing sse vs streamable-http)"
echo ""
echo "📝 To apply patches manually:"
echo "   git apply patches/streamable-http-session-fix.patch"
echo "   git apply patches/transport-option.patch"
echo "   git apply patches/browser-context-isolation.patch"
