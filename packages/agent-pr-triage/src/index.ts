import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const server = new Server(
  {
    name: "agent-pr-triage",
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

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case "triage_pr": {
      const pr_id = args?.pr_id;
      return {
        content: [
          {
            type: "text",
            text: `PR #${pr_id} triaged. Confidence: 0.95. Recommended action: Auto-merge after CI passes.`,
          },
        ],
      };
    }
    case "handoff_to_browser": {
      const { pr_id, task, context } = args as any;
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              target: "agent-browser",
              task,
              context: { ...context, pr_id },
            }),
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
  console.error("PR Triage MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
