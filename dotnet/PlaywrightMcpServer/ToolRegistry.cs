using System.Text.Json;
using PlaywrightMcpServer.Browser;

namespace PlaywrightMcpServer;

internal sealed class ToolRegistry
{
    private readonly BrowserManager _browserManager;
    private readonly CommandLineOptions _options;
    private readonly List<ToolDefinition> _tools = new();
    private readonly Dictionary<string, ToolDefinition> _toolMap = new(StringComparer.Ordinal);

    public ToolRegistry(CommandLineOptions options, BrowserManager browserManager)
    {
        _browserManager = browserManager;
        _options = options;
        BuildTools();
    }

    public IReadOnlyList<object> ListTools()
    {
        return _tools.Select(tool => tool.ToJson()).ToArray();
    }

    public async Task<McpResponse> CallToolAsync(string name, JsonElement? arguments)
    {
        if (!_toolMap.TryGetValue(name, out var tool))
            return ResponseBuilder.Error($"Tool \"{name}\" not found");
        if (tool.Handler == null)
            return ResponseBuilder.Error($"Tool \"{name}\" is not implemented in this server.");
        try
        {
            return await tool.Handler(arguments);
        }
        catch (Exception ex)
        {
            return ResponseBuilder.Error(ex.Message);
        }
    }

    private void BuildTools()
    {
        AddTool(CreateNavigateTool());
        AddTool(CreateNavigateBackTool());
        AddTool(CreateClickTool());

        AddTool(CreateStubTool("browser_console_messages", "Read console messages", "Inspect console output", ToolType.ReadOnly));
        AddTool(CreateStubTool("browser_drag", "Drag element", "Drag an element on the page", ToolType.Destructive));
        AddTool(CreateStubTool("browser_evaluate", "Evaluate script", "Evaluate JavaScript in the page", ToolType.Destructive));
        AddTool(CreateStubTool("browser_file_upload", "Upload file", "Upload a file to an input", ToolType.Destructive));
        AddTool(CreateStubTool("browser_fill_form", "Fill form", "Fill a form field", ToolType.Destructive));
        AddTool(CreateStubTool("browser_handle_dialog", "Handle dialog", "Handle browser dialogs", ToolType.Destructive));
        AddTool(CreateStubTool("browser_hover", "Hover element", "Hover an element", ToolType.Destructive));
        AddTool(CreateStubTool("browser_select_option", "Select option", "Select option in a form control", ToolType.Destructive));
        AddTool(CreateStubTool("browser_type", "Type text", "Type into an element", ToolType.Destructive));
        AddTool(CreateStubTool("browser_close", "Close tab", "Close the current tab", ToolType.Destructive));
        AddTool(CreateStubTool("browser_install", "Install browser", "Install additional browser binaries", ToolType.Destructive));
        AddTool(CreateStubTool("browser_network_requests", "Inspect network", "Inspect network requests", ToolType.ReadOnly));
        AddTool(CreateStubTool("browser_press_key", "Press key", "Press a key in the page", ToolType.Destructive));
        AddTool(CreateStubTool("browser_resize", "Resize page", "Resize the page viewport", ToolType.Destructive));
        AddTool(CreateStubTool("browser_snapshot", "Take snapshot", "Capture a DOM snapshot", ToolType.ReadOnly));
        AddTool(CreateStubTool("browser_tabs", "List tabs", "List open tabs", ToolType.ReadOnly));
        AddTool(CreateStubTool("browser_take_screenshot", "Screenshot", "Capture a screenshot", ToolType.ReadOnly));
        AddTool(CreateStubTool("browser_wait_for", "Wait for", "Wait for a condition", ToolType.Destructive));

        if (_options.IncludeConnectTool)
            AddTool(CreateStubTool("browser_connect", "Connect to browser", "Connect to an existing browser", ToolType.Destructive));

        if (_options.Capabilities.Contains("pdf"))
            AddTool(CreateStubTool("browser_pdf_save", "Save PDF", "Save the current page as PDF", ToolType.Destructive, capability: "pdf"));

        if (_options.Capabilities.Contains("vision"))
        {
            AddTool(CreateStubTool("browser_mouse_move_xy", "Move mouse", "Move the mouse using coordinates", ToolType.Destructive, capability: "vision"));
            AddTool(CreateStubTool("browser_mouse_click_xy", "Click mouse", "Click using page coordinates", ToolType.Destructive, capability: "vision"));
            AddTool(CreateStubTool("browser_mouse_drag_xy", "Drag mouse", "Drag using page coordinates", ToolType.Destructive, capability: "vision"));
        }

    }

    private void AddTool(ToolDefinition tool)
    {
        if (_toolMap.ContainsKey(tool.Name))
            return;
        _toolMap[tool.Name] = tool;
        _tools.Add(tool);
    }

    private ToolDefinition CreateNavigateTool()
    {
        var inputSchema = new
        {
            type = "object",
            properties = new Dictionary<string, object>
            {
                ["url"] = new Dictionary<string, object>
                {
                    ["type"] = "string",
                    ["description"] = "The URL to navigate to"
                }
            },
            required = new[] { "url" }
        };

        return new ToolDefinition(
            name: "browser_navigate",
            title: "Navigate to a URL",
            description: "Navigate to a URL",
            type: ToolType.Destructive,
            capability: "core",
            inputSchema: inputSchema,
            handler: async args =>
            {
                if (args is not { ValueKind: JsonValueKind.Object } element || !element.TryGetProperty("url", out var urlElement) || urlElement.ValueKind != JsonValueKind.String)
                    return ResponseBuilder.Error("Missing \"url\" argument.");
                var url = urlElement.GetString()!;
                await _browserManager.NavigateAsync(url);
                var snapshot = await _browserManager.CaptureSnapshotAsync();
                var code = $"await page.goto('{ResponseBuilder.EscapeJavaScript(url)}');";
                return ResponseBuilder.Success(code, snapshot);
            }
        );
    }

    private ToolDefinition CreateNavigateBackTool()
    {
        return CreateStubTool("browser_navigate_back", "Go back", "Navigate to the previous page", ToolType.Destructive);
    }

    private ToolDefinition CreateClickTool()
    {
        var inputSchema = new
        {
            type = "object",
            properties = new Dictionary<string, object>
            {
                ["element"] = new Dictionary<string, object>
                {
                    ["type"] = "string",
                    ["description"] = "The textual description of the element"
                },
                ["ref"] = new Dictionary<string, object>
                {
                    ["type"] = "string",
                    ["description"] = "Element reference returned from page snapshot"
                }
            },
            required = new[] { "element", "ref" }
        };

        return new ToolDefinition(
            name: "browser_click",
            title: "Click element",
            description: "Click an element on the page",
            type: ToolType.Destructive,
            capability: "core",
            inputSchema: inputSchema,
            handler: async args =>
            {
                if (args is not { ValueKind: JsonValueKind.Object } element)
                    return ResponseBuilder.Error("Invalid arguments for browser_click.");
                if (!element.TryGetProperty("ref", out var refElement) || refElement.ValueKind != JsonValueKind.String)
                    return ResponseBuilder.Error("Missing \"ref\" argument.");
                var refId = refElement.GetString()!;
                if (!_browserManager.TryGetElement(refId, out var info))
                    return ResponseBuilder.Error($"Element reference '{refId}' was not found. Use browser_navigate to refresh the page state.");

                await _browserManager.ClickAsync(info);
                var snapshot = await _browserManager.CaptureSnapshotAsync();
                var code = _browserManager.BuildClickSnippet(info);
                return ResponseBuilder.Success(code, snapshot);
            }
        );
    }

    private static ToolDefinition CreateStubTool(string name, string title, string description, ToolType type, string capability = "core")
    {
        var inputSchema = new
        {
            type = "object",
            properties = new Dictionary<string, object>(),
            required = Array.Empty<string>()
        };

        return new ToolDefinition(
            name,
            title,
            description,
            type,
            capability,
            inputSchema,
            handler: _ => Task.FromResult(ResponseBuilder.Error($"Tool \"{name}\" is not implemented in the C# server."))
        );
    }
}

internal enum ToolType
{
    Destructive,
    ReadOnly
}

internal sealed class ToolDefinition
{
    public ToolDefinition(string name, string title, string description, ToolType type, string capability, object inputSchema, Func<JsonElement?, Task<McpResponse>> handler)
    {
        Name = name;
        Title = title;
        Description = description;
        Type = type;
        Capability = capability;
        InputSchema = inputSchema;
        Handler = handler;
    }

    public string Name { get; }

    public string Title { get; }

    public string Description { get; }

    public ToolType Type { get; }

    public string Capability { get; }

    public object InputSchema { get; }

    public Func<JsonElement?, Task<McpResponse>>? Handler { get; }

    public object ToJson()
    {
        return new
        {
            name = Name,
            description = Description,
            inputSchema = InputSchema,
            annotations = new
            {
                title = Title,
                readOnlyHint = Type == ToolType.ReadOnly,
                destructiveHint = Type == ToolType.Destructive,
                openWorldHint = true
            }
        };
    }
}
