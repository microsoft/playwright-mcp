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
  { name: "agent-orchestrator", version: "0.0.1" },
  { capabilities: { tools: {} } }
);

// ─── Tool definitions ─────────────────────────────────────────────────────────

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "route_task",
      description: "Route a task to the appropriate agent (triage or browser)",
      inputSchema: {
        type: "object",
        properties: {
          agent: { enum: ["pr-triage", "browser"] },
          task: { type: "string" },
          payload: { type: "object" },
        },
        required: ["agent", "task"],
      },
    },
    {
      name: "request_human_review",
      description: "Request human review for low-confidence actions",
      inputSchema: {
        type: "object",
        properties: {
          task_id: { type: "string" },
          reason: { type: "string" },
          context: { type: "object" },
        },
        required: ["task_id", "reason"],
      },
    },
  ],
}));

// ─── Tool handlers ────────────────────────────────────────────────────────────

const toolHandlers: Record<string, ToolHandler> = {
  route_task: (args) => {
    const agent = args["agent"] as string;
    const task = args["task"] as string;
    const payload = args["payload"] as Record<string, unknown> | undefined;
    const detail = payload ? ` Payload keys: ${Object.keys(payload).join(", ")}.` : "";
    return {
      content: [
        {
          type: "text",
          text: `Task successfully routed to ${agent}: "${task}". Status: PENDING.${detail}`,
        },
      ],
    };
  },

  request_human_review: (args) => {
    const task_id = args["task_id"] as string;
    const reason = args["reason"] as string;
    return {
      content: [
        {
          type: "text",
          text: `Human review requested for task ${task_id}. Reason: ${reason}. Gate: LOCKED.`,
        },
      ],
    };
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
  console.error("Orchestrator MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
