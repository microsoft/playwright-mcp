// Extension: playwright-mcp
// Exposes Playwright browser automation tools by spawning the Node.js MCP server via stdio

import { joinSession } from "@github/copilot-sdk/extension";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { existsSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Resolve repo root:
//   - Project-level install (.github/extensions/playwright-mcp/): go up 3 dirs
//   - User-level install (~/.copilot/extensions/playwright-mcp/): must set PLAYWRIGHT_MCP_DIR
const repoRoot = process.env.PLAYWRIGHT_MCP_DIR ?? join(__dirname, "..", "..", "..");
const cliPath = join(repoRoot, "packages", "playwright-mcp", "cli.js");

if (!existsSync(cliPath)) {
    throw new Error(
        `[playwright-mcp] Cannot find cli.js at "${cliPath}".\n` +
        `For user-level installs, set the PLAYWRIGHT_MCP_DIR environment variable ` +
        `to the absolute path of your cloned playwright-mcp repository.\n` +
        `Example: export PLAYWRIGHT_MCP_DIR="/Users/you/Workspace/playwright-mcp"`
    );
}

// Build CLI args. If PLAYWRIGHT_MCP_EXTENSION_TOKEN is set, connect to the
// "Playwright MCP Bridge" Chrome extension (real browser with login sessions).
// Otherwise run a headless browser.
const cliArgs = process.env.PLAYWRIGHT_MCP_EXTENSION_TOKEN
    ? ["--extension"]
    : ["--headless"];

// ---------------------------------------------------------------------------
// MCP subprocess state
// ---------------------------------------------------------------------------

let mcpProcess = null;
let mcpReady = false;
let requestId = 1;
const pending = new Map();

function serialize(msg) {
    return JSON.stringify(msg) + "\n";
}

function createFrameParser(onMessage) {
    let buf = "";
    return (chunk) => {
        buf += chunk.toString("utf8");
        const lines = buf.split("\n");
        buf = lines.pop();
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            try { onMessage(JSON.parse(trimmed)); } catch (_) {}
        }
    };
}

function handleMessage(msg) {
    if (msg.id == null) return;
    const p = pending.get(msg.id);
    if (!p) return;
    pending.delete(msg.id);
    if (msg.error) p.reject(new Error(msg.error.message ?? JSON.stringify(msg.error)));
    else p.resolve(msg.result);
}

async function ensureConnected() {
    if (mcpProcess && mcpReady) return;
    mcpProcess = null;
    mcpReady = false;
    await new Promise((resolve, reject) => {
        const proc = spawn("node", [cliPath, ...cliArgs], {
            cwd: repoRoot,
            stdio: ["pipe", "pipe", "inherit"],
            env: { ...process.env },
        });
        proc.on("error", (err) => { mcpProcess = null; mcpReady = false; reject(err); });
        proc.on("exit", () => { mcpProcess = null; mcpReady = false; });
        proc.stdout.on("data", createFrameParser(handleMessage));
        mcpProcess = proc;
        const id = requestId++;
        pending.set(id, {
            resolve: () => {
                mcpProcess.stdin.write(serialize({ jsonrpc: "2.0", method: "notifications/initialized" }));
                mcpReady = true;
                resolve();
            },
            reject: (e) => { mcpProcess = null; reject(e); },
        });
        mcpProcess.stdin.write(serialize({
            jsonrpc: "2.0", id,
            method: "initialize",
            params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "copilot-playwright-mcp", version: "0.1.0" } },
        }));
    });
}

async function callTool(name, args) {
    await ensureConnected();
    const result = await new Promise((resolve, reject) => {
        const id = requestId++;
        pending.set(id, { resolve, reject });
        mcpProcess.stdin.write(serialize({ jsonrpc: "2.0", id, method: "tools/call", params: { name, arguments: args ?? {} } }));
    });
    if (Array.isArray(result?.content) && result.content.length > 0)
        return result.content.map((c) => c.text ?? JSON.stringify(c)).join("\n");
    return JSON.stringify(result);
}

// ---------------------------------------------------------------------------
// Extension
// ---------------------------------------------------------------------------

const session = await joinSession({
    tools: [
        // ── Navigation ──────────────────────────────────────────────────────
        {
            name: "browser_navigate",
            description: "Navigate to a URL",
            parameters: {
                type: "object",
                properties: {
                    url: { type: "string", description: "The URL to navigate to" },
                },
                required: ["url"],
            },
            skipPermission: false,
            handler: async ({ url }) => callTool("browser_navigate", { url }),
        },
        {
            name: "browser_navigate_back",
            description: "Go back to the previous page in the history",
            parameters: { type: "object", properties: {}, required: [] },
            skipPermission: false,
            handler: async () => callTool("browser_navigate_back", {}),
        },

        // ── Observation ──────────────────────────────────────────────────────
        {
            name: "browser_snapshot",
            description: "Capture accessibility snapshot of the current page — better than a screenshot for understanding page structure",
            parameters: {
                type: "object",
                properties: {
                    filename: { type: "string", description: "Save snapshot to a markdown file instead of returning it in the response" },
                    selector: { type: "string", description: "Element selector of the root element to capture a partial snapshot" },
                },
                required: [],
            },
            skipPermission: true,
            handler: async (args) => callTool("browser_snapshot", args),
        },
        {
            name: "browser_take_screenshot",
            description: "Take a screenshot of the current page. Use browser_snapshot for actions — screenshots are for visual reference only.",
            parameters: {
                type: "object",
                properties: {
                    type: { type: "string", description: "Image format: 'png' or 'jpeg'. Defaults to 'png'." },
                    filename: { type: "string", description: "File name to save the screenshot to. Defaults to page-{timestamp}.{ext}." },
                    element: { type: "string", description: "Human-readable element description. If provided, ref must also be provided." },
                    ref: { type: "string", description: "Exact target element reference from the page snapshot." },
                    selector: { type: "string", description: "CSS or role selector for the target element, when ref is not available." },
                    fullPage: { type: "boolean", description: "When true, captures the full scrollable page. Cannot be used with element screenshots." },
                },
                required: [],
            },
            skipPermission: true,
            handler: async (args) => callTool("browser_take_screenshot", args),
        },
        {
            name: "browser_console_messages",
            description: "Returns all console messages from the current page",
            parameters: {
                type: "object",
                properties: {
                    level: { type: "string", description: "Level of messages to return: 'error', 'warning', 'info', 'debug'. Each level includes more severe levels. Defaults to 'info'." },
                    all: { type: "boolean", description: "Return all messages since session start, not just since last navigation. Defaults to false." },
                    filename: { type: "string", description: "Filename to save messages to. If not provided, returned as text." },
                },
                required: ["level"],
            },
            skipPermission: true,
            handler: async (args) => callTool("browser_console_messages", args),
        },
        {
            name: "browser_network_requests",
            description: "Returns all network requests since loading the page",
            parameters: {
                type: "object",
                properties: {
                    includeStatic: { type: "boolean", description: "Whether to include static resources (images, fonts, scripts). Defaults to false." },
                    filename: { type: "string", description: "Filename to save requests to. If not provided, returned as text." },
                },
                required: ["includeStatic"],
            },
            skipPermission: true,
            handler: async (args) => callTool("browser_network_requests", args),
        },

        // ── Interaction ──────────────────────────────────────────────────────
        {
            name: "browser_click",
            description: "Perform a click on a web page element",
            parameters: {
                type: "object",
                properties: {
                    element: { type: "string", description: "Human-readable element description used to obtain permission" },
                    ref: { type: "string", description: "Exact target element reference from the page snapshot" },
                    selector: { type: "string", description: "CSS or role selector for the target element, when ref is not available" },
                    doubleClick: { type: "boolean", description: "Whether to perform a double click instead of a single click" },
                    button: { type: "string", description: "Button to click: 'left', 'right', 'middle'. Defaults to left." },
                    modifiers: { type: "array", items: { type: "string" }, description: "Modifier keys to press (e.g., 'Shift', 'Control')" },
                },
                required: ["ref"],
            },
            skipPermission: false,
            handler: async (args) => callTool("browser_click", args),
        },
        {
            name: "browser_type",
            description: "Type text into an editable element",
            parameters: {
                type: "object",
                properties: {
                    element: { type: "string", description: "Human-readable element description" },
                    ref: { type: "string", description: "Exact target element reference from the page snapshot" },
                    selector: { type: "string", description: "CSS or role selector, when ref is not available" },
                    text: { type: "string", description: "Text to type into the element" },
                    submit: { type: "boolean", description: "Whether to press Enter after typing" },
                    slowly: { type: "boolean", description: "Whether to type one character at a time (triggers key handlers)" },
                },
                required: ["ref", "text"],
            },
            skipPermission: false,
            handler: async (args) => callTool("browser_type", args),
        },
        {
            name: "browser_hover",
            description: "Hover the mouse over an element on the page",
            parameters: {
                type: "object",
                properties: {
                    element: { type: "string", description: "Human-readable element description" },
                    ref: { type: "string", description: "Exact target element reference from the page snapshot" },
                    selector: { type: "string", description: "CSS or role selector, when ref is not available" },
                },
                required: ["ref"],
            },
            skipPermission: false,
            handler: async (args) => callTool("browser_hover", args),
        },
        {
            name: "browser_press_key",
            description: "Press a key on the keyboard",
            parameters: {
                type: "object",
                properties: {
                    key: { type: "string", description: "Name of the key (e.g., 'ArrowLeft', 'Enter') or a character (e.g., 'a')" },
                },
                required: ["key"],
            },
            skipPermission: false,
            handler: async ({ key }) => callTool("browser_press_key", { key }),
        },
        {
            name: "browser_drag",
            description: "Perform drag and drop between two elements",
            parameters: {
                type: "object",
                properties: {
                    startElement: { type: "string", description: "Human-readable source element description" },
                    startRef: { type: "string", description: "Exact source element reference from the page snapshot" },
                    startSelector: { type: "string", description: "CSS or role selector for source, when startRef is not available" },
                    endElement: { type: "string", description: "Human-readable target element description" },
                    endRef: { type: "string", description: "Exact target element reference from the page snapshot" },
                    endSelector: { type: "string", description: "CSS or role selector for target, when endRef is not available" },
                },
                required: ["startElement", "startRef", "endElement", "endRef"],
            },
            skipPermission: false,
            handler: async (args) => callTool("browser_drag", args),
        },
        {
            name: "browser_fill_form",
            description: "Fill multiple form fields at once",
            parameters: {
                type: "object",
                properties: {
                    fields: {
                        type: "array",
                        description: "Fields to fill in",
                        items: { type: "object" },
                    },
                },
                required: ["fields"],
            },
            skipPermission: false,
            handler: async ({ fields }) => callTool("browser_fill_form", { fields }),
        },
        {
            name: "browser_select_option",
            description: "Select an option in a dropdown",
            parameters: {
                type: "object",
                properties: {
                    element: { type: "string", description: "Human-readable element description" },
                    ref: { type: "string", description: "Exact target element reference from the page snapshot" },
                    selector: { type: "string", description: "CSS or role selector, when ref is not available" },
                    values: { type: "array", items: { type: "string" }, description: "Array of values to select" },
                },
                required: ["ref", "values"],
            },
            skipPermission: false,
            handler: async (args) => callTool("browser_select_option", args),
        },
        {
            name: "browser_handle_dialog",
            description: "Handle a browser dialog (alert, confirm, prompt)",
            parameters: {
                type: "object",
                properties: {
                    accept: { type: "boolean", description: "Whether to accept the dialog" },
                    promptText: { type: "string", description: "Text to enter in a prompt dialog" },
                },
                required: ["accept"],
            },
            skipPermission: false,
            handler: async (args) => callTool("browser_handle_dialog", args),
        },
        {
            name: "browser_file_upload",
            description: "Upload one or multiple files via a file input",
            parameters: {
                type: "object",
                properties: {
                    paths: { type: "array", items: { type: "string" }, description: "Absolute paths to the files to upload. If omitted, the file chooser is cancelled." },
                },
                required: [],
            },
            skipPermission: false,
            handler: async (args) => callTool("browser_file_upload", args),
        },

        // ── Waiting / Timing ─────────────────────────────────────────────────
        {
            name: "browser_wait_for",
            description: "Wait for text to appear or disappear, or for a specified time to pass",
            parameters: {
                type: "object",
                properties: {
                    time: { type: "number", description: "Time to wait in seconds" },
                    text: { type: "string", description: "Text to wait for to appear" },
                    textGone: { type: "string", description: "Text to wait for to disappear" },
                },
                required: [],
            },
            skipPermission: false,
            handler: async (args) => callTool("browser_wait_for", args),
        },

        // ── Scripting ────────────────────────────────────────────────────────
        {
            name: "browser_evaluate",
            description: "Evaluate a JavaScript expression on the page or a specific element",
            parameters: {
                type: "object",
                properties: {
                    function: { type: "string", description: "() => { /* code */ } or (element) => { /* code */ } when element is provided" },
                    element: { type: "string", description: "Human-readable element description" },
                    ref: { type: "string", description: "Exact target element reference" },
                    selector: { type: "string", description: "CSS or role selector, when ref is not available" },
                },
                required: ["function"],
            },
            skipPermission: false,
            handler: async (args) => callTool("browser_evaluate", args),
        },
        {
            name: "browser_run_code",
            description: "Run a Playwright code snippet. Receives a `page` argument. Example: `async (page) => { await page.getByRole('button', { name: 'Submit' }).click(); return await page.title(); }`",
            parameters: {
                type: "object",
                properties: {
                    code: { type: "string", description: "A JavaScript async function that receives `page` as its only argument" },
                },
                required: ["code"],
            },
            skipPermission: false,
            handler: async ({ code }) => callTool("browser_run_code", { code }),
        },

        // ── Window / Tabs ────────────────────────────────────────────────────
        {
            name: "browser_resize",
            description: "Resize the browser window",
            parameters: {
                type: "object",
                properties: {
                    width: { type: "number", description: "Width of the browser window in pixels" },
                    height: { type: "number", description: "Height of the browser window in pixels" },
                },
                required: ["width", "height"],
            },
            skipPermission: false,
            handler: async ({ width, height }) => callTool("browser_resize", { width, height }),
        },
        {
            name: "browser_tabs",
            description: "List, create, close, or select a browser tab",
            parameters: {
                type: "object",
                properties: {
                    action: { type: "string", description: "Operation to perform: 'list', 'new', 'close', or 'select'" },
                    index: { type: "number", description: "Tab index, used for close/select. If omitted for close, the current tab is closed." },
                },
                required: ["action"],
            },
            skipPermission: false,
            handler: async (args) => callTool("browser_tabs", args),
        },
        {
            name: "browser_close",
            description: "Close the current browser page",
            parameters: { type: "object", properties: {}, required: [] },
            skipPermission: false,
            handler: async () => callTool("browser_close", {}),
        },
    ],
});

await session.log("Playwright MCP extension loaded ✓");
