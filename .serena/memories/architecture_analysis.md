# Architecture Analysis for Performance Improvements

## Current Architecture

### Core Components
1. **MCP Server** (`src/mcp/server.ts`)
   - Handles tool registration and execution
   - Manages request/response lifecycle
   - Uses Zod for input validation

2. **Response System** (`src/response.ts`)
   - Collects tool output (results, code, images)
   - Captures page snapshots and console messages
   - Serializes all data for client transmission

3. **Tools** (`src/tools/`)
   - Individual tool implementations
   - Each tool uses Response class to collect output
   - Currently no filtering mechanism

### Performance Bottlenecks

#### 1. Response Verbosity
- `Response.serialize()` always includes:
  - Full page snapshots (ARIA tree)
  - All console messages
  - Tab information
  - Complete tool results
- No way to opt out of unnecessary data

#### 2. Single Tool Execution
- Each tool call requires separate MCP request/response
- No batching mechanism for related operations
- High round-trip latency for multi-step workflows

## Proposed Architecture Changes

### 1. Response Filtering System
**Files to modify:**
- `src/response.ts` - Add expectation handling
- `src/tools/tool.ts` - Add expectation parameter to tool interface
- `src/mcp/server.ts` - Parse expectation from tool arguments

**Key Changes:**
- Add `expectation` parameter to all tools
- Modify `Response.serialize()` to filter based on expectations
- Implement selective snapshot capture

### 2. Batch Execution System
**New files:**
- `src/tools/batch.ts` - Batch execution tool
- `src/batchExecutor.ts` - Batch execution logic

**Integration points:**
- Register batch tool in main tools list
- Reuse existing tool validation and execution logic
- Provide unified error handling and result collection

## Implementation Priority

### Phase 1: Response Filtering (Higher Impact)
- Smaller code changes
- Immediate token reduction benefits
- Backward compatible with default values

### Phase 2: Batch Execution (Medium Impact)
- More complex implementation
- Requires careful error handling design
- Significant performance gains for complex workflows

## Compatibility Considerations
- All changes should be backward compatible
- Existing tool calls should work unchanged
- New features should be opt-in with sensible defaults