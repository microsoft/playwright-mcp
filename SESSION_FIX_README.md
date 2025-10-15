# Streamable-HTTP Session Management Fix

This branch contains the fix for the streamable-http session management issue.

## The Problem
Multi-step operations (like screenshots) would fail with 'Session not found' errors due to aggressive session cleanup in the streamable-http transport.

## The Solution
The fix involves:
1. Removing premature session cleanup in the handleStreamable function
2. Adding a --transport option to choose between 'sse' and 'streamable-http'

## Implementation
The actual changes are in the Playwright source repository:
- \packages/playwright/src/mcp/sdk/http.ts\ - Fixed session management
- \packages/playwright/src/mcp/program.ts\ - Added --transport option  
- \packages/playwright/src/mcp/sdk/server.ts\ - Updated server config

## Testing
This fix resolves the 'Session not found' errors that occurred during multi-step operations like:
- Navigate to page
- Take screenshot
- Extract data

The session now persists correctly across multiple HTTP requests.
