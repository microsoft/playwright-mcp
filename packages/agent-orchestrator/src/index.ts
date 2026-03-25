// Orchestrator Logic
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const server = new Server(
  {
    name: "agent-orchestrator",
    version: "0.0.1",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

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

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case "route_task": {
      const { agent, task, payload } = args as any;
      return {
        content: [
          {
            type: "text",
            text: `Task successfully routed to ${agent}. Status: PENDING.`,
          },
        ],
      };
    }
    case "request_human_review": {
      const { task_id, reason } = args as any;
      return {
        content: [
          {
            type: "text",
            text: `Human review requested for task ${task_id}. Reason: ${reason}. Gate: LOCKED.`,
          },
        ],
      };
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Orchestrator MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
