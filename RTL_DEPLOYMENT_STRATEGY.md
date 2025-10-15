# RTL Playwright MCP Custom Deployment Strategy

## 🎯 Overview

Since RTL is likely the only production Kubernetes user of Playwright MCP, we can deploy our fixes immediately using a custom Docker image without waiting for Microsoft's approval.

## 🚨 Critical Issues Fixed

### 1. Streamable-HTTP Session Management
- **Problem**: Multi-step operations failed with "Session not found" errors
- **Root Cause**: Premature session cleanup in `handleStreamable` function
- **Fix**: Remove aggressive session deletion, allow sessions to persist until server shutdown

### 2. Browser Context Isolation  
- **Problem**: Sessions could share browser state (cookies, localStorage, cache)
- **Root Cause**: User data directories based only on client name/version
- **Fix**: Add session-specific UUID to user data directory creation

### 3. Transport Option Support
- **Problem**: No way to choose between SSE and streamable-http transport
- **Fix**: Add `--transport` CLI option

## 🏗️ Architecture Impact

### Local Usage (Unaffected)
- ✅ **Local MCP uses stdio transport** (no HTTP sessions)
- ✅ **No session management issues locally**
- ✅ **No impact on existing local users**

### Server Usage (Fixed)
- ✅ **HTTP/streamable-http transport** now works correctly
- ✅ **Sessions persist** across multiple requests
- ✅ **Browser contexts isolated** between sessions
- ✅ **Multi-step operations** (navigate → screenshot → extract) work

## 🚀 Deployment Options

### Option 1: Custom RTL Docker Image ⭐ **RECOMMENDED**

**Advantages:**
- ✅ **Deploy immediately** without waiting for Microsoft
- ✅ **Full control** over fixes and configuration
- ✅ **No impact** on local MCP users
- ✅ **Easy rollback** if issues occur

**Steps:**
1. Build custom Docker image with our fixes
2. Push to RTL's Azure Container Registry
3. Update RTL platform-mcps configuration
4. Deploy via ArgoCD

### Option 2: Wait for Microsoft PR

**Disadvantages:**
- ❌ **Long timeline** (2-3 weeks minimum)
- ❌ **No guarantee** Microsoft will prioritize
- ❌ **Blocks RTL** from using Playwright MCP in production

## 📋 Custom Image Deployment Steps

### 1. Build Custom Image
```bash
cd /Users/bsingh/Documents/RTL/playwright-mcp
./build-rtl-custom.sh
```

### 2. Push to RTL ACR
```bash
docker tag rtl-playwright-mcp:custom-20241015-143022 prodacrfreemiumwecai.azurecr.io/rtl-playwright-mcp:custom-20241015-143022
docker push prodacrfreemiumwecai.azurecr.io/rtl-playwright-mcp:custom-20241015-143022
```

### 3. Update RTL Configuration
```yaml
# modules/platform-mcps/values.yaml
- playwright:
    name: playwright
    service: {}
    enabled: true
    image:
        repository: prodacrfreemiumwecai.azurecr.io/rtl-playwright-mcp
        tag: custom-20241015-143022
        pullPolicy: Always
    containerPort: 8080
    useTcpProbe: true
    args: ["--host", "0.0.0.0", "--port", "8080", "--headless", "--browser", "chromium", "--transport", "streamable-http"]
    env:
      DEBUG: pw:mcp:*
    useSpotInstances: true
    resources:
      requests:
        cpu: 5m
        memory: 80Mi
      limits:
        cpu: 100m
        memory: 0.5Gi
```

### 4. Deploy via ArgoCD
```bash
git add modules/platform-mcps/values.yaml
git commit -m "Deploy custom Playwright MCP with session management fixes"
git push origin main
# ArgoCD will automatically sync and deploy
```

## 🧪 Testing Strategy

### 1. Local Testing
```bash
# Test custom image locally
docker run -p 8080:8080 rtl-playwright-mcp:custom-20241015-143022

# Test multi-step operations
curl -X POST http://localhost:8080/mcp \
  -H "Content-Type: application/json" \
  -H "mcp-session-id: test-session" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"browser_navigate","arguments":{"url":"https://www.buienradar.nl/"}}}'

curl -X POST http://localhost:8080/mcp \
  -H "Content-Type: application/json" \
  -H "mcp-session-id: test-session" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"browser_take_screenshot","arguments":{"filename":"test.png"}}}'
```

### 2. Kubernetes Testing
- Deploy to staging environment first
- Test multi-step operations
- Verify session isolation
- Monitor logs for any issues

## 🔄 Maintenance Strategy

### Short Term (Immediate)
- ✅ **Deploy custom image** with fixes
- ✅ **Monitor production** usage
- ✅ **Collect feedback** from users

### Medium Term (1-2 months)
- ✅ **Submit PRs to Microsoft** for upstream fixes
- ✅ **Maintain custom image** until Microsoft merges
- ✅ **Update documentation** with lessons learned

### Long Term (3+ months)
- ✅ **Switch to official image** once Microsoft merges fixes
- ✅ **Archive custom image** 
- ✅ **Contribute back** to community

## 🎯 Success Metrics

### Technical Metrics
- ✅ **Multi-step operations** succeed (navigate → screenshot → extract)
- ✅ **Session persistence** across requests
- ✅ **No state pollution** between sessions
- ✅ **Zero "Session not found"** errors

### Business Metrics
- ✅ **Playwright MCP** usable in production
- ✅ **Reliable testing** of user-reported issues
- ✅ **Faster incident response** with automated verification
- ✅ **Improved developer productivity**

## 🚨 Risk Mitigation

### If Custom Image Fails
- **Rollback**: Revert to previous working configuration
- **Debug**: Check logs and fix issues
- **Redeploy**: Apply fixes and try again

### If Microsoft Rejects PRs
- **Continue**: Maintain custom image long-term
- **Fork**: Consider maintaining our own fork
- **Community**: Share fixes with other Kubernetes users

## 📞 Next Steps

1. **Build and test** custom Docker image
2. **Deploy to staging** environment
3. **Validate fixes** work correctly
4. **Deploy to production** via ArgoCD
5. **Monitor and maintain** custom image
6. **Submit PRs** to Microsoft for upstream fixes

This approach gives RTL immediate access to working Playwright MCP while maintaining the option to contribute back to the community! 🚀
