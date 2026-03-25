import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

// ─── Types ────────────────────────────────────────────────────────────────────

type ToolArgs = Record<string, unknown>;
type ToolResult = { content: Array<{ type: string; text: string }> };

/**
 * A handler receives the validated arguments for one tool and returns a
 * content array. Adding a new tool means adding a new entry here — the
 * dispatch logic does not need to change (Open/Closed Principle).
 */
type ToolHandler = (args: ToolArgs) => ToolResult;

// ─── Server ──────────────────────────────────────────────────────────────────

const server = new Server(
  { name: "agent-pr-triage", version: "0.0.1" },
  { capabilities: { tools: {} } }
);

// ─── Tool definitions ─────────────────────────────────────────────────────────

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "triage_pr",
      description: "Analyze a PR and determine the next steps (labeling, commenting, or handoff)",
      inputSchema: {
        type: "object",
        properties: {
          pr_id: { type: "number" },
          context: { type: "string" },
        },
        required: ["pr_id"],
      },
    },
    {
      name: "handoff_to_browser",
      description: "Hand off complex UI/Browser tasks to the Browser Agent",
      inputSchema: {
        type: "object",
        properties: {
          pr_id: { type: "number" },
          task: { type: "string" },
          context: { type: "object" },
        },
        required: ["pr_id", "task"],
      },
    },
  ],
}));

// ─── Tool handlers ────────────────────────────────────────────────────────────

const toolHandlers: Record<string, ToolHandler> = {
  triage_pr: (_args) => {
    throw new Error("Not implemented: triage_pr requires a real GitHub integration");
  },

  handoff_to_browser: (_args) => {
    throw new Error("Not implemented: handoff_to_browser requires a real agent runtime");
  },
};

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const handler = toolHandlers[name];
  if (!handler)
    throw new Error(`Unknown tool: ${name}`);
  return handler((args ?? {}) as ToolArgs);
});

// ─── Entry point ──────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("PR Triage MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
