using System.ComponentModel;
using System.ComponentModel.DataAnnotations;
using System.Threading;
using ModelContextProtocol.Server;
using PlaywrightMcpServer.Browser;

namespace PlaywrightMcpServer;

internal sealed class BrowserTools
{
    private readonly BrowserManager _browserManager;

    public BrowserTools(BrowserManager browserManager)
    {
        _browserManager = browserManager;
    }

    [McpServerTool("browser_navigate", "Navigate to a URL")]
    [Description("Navigate the active page to a specific URL.")]
    [McpServerToolType(ToolType.Destructive)]
    public async Task<McpResponse> NavigateAsync(NavigateArguments arguments, CancellationToken cancellationToken)
    {
        await _browserManager.NavigateAsync(arguments.Url, cancellationToken);
        var snapshot = await _browserManager.CaptureSnapshotAsync(cancellationToken);
        var code = $"await page.goto('{ResponseBuilder.EscapeJavaScript(arguments.Url)}');";
        return ResponseBuilder.Success(code, snapshot);
    }

    [McpServerTool("browser_navigate_back", "Go back")]
    [Description("Navigate to the previous page in the browser history.")]
    [McpServerToolType(ToolType.Destructive)]
    public Task<McpResponse> NavigateBackAsync()
        => NotImplementedAsync("browser_navigate_back");

    [McpServerTool("browser_click", "Click element")]
    [Description("Click an element by CSS/XPath/text selector.")]
    [McpServerToolType(ToolType.Destructive)]
    public async Task<McpResponse> ClickAsync(ClickArguments arguments, CancellationToken cancellationToken)
    {
        var code = await _browserManager.ClickAsync(arguments.Selector, cancellationToken);
        var snapshot = await _browserManager.CaptureSnapshotAsync(cancellationToken);
        return ResponseBuilder.Success(code, snapshot);
    }

    [McpServerTool("browser_console_messages", "Read console messages")]
    [Description("Inspect console output")]
    [McpServerToolType(ToolType.ReadOnly)]
    public Task<McpResponse> ReadConsoleMessagesAsync() => NotImplementedAsync("browser_console_messages");

    [McpServerTool("browser_drag", "Drag element")]
    [Description("Drag an element on the page")]
    [McpServerToolType(ToolType.Destructive)]
    public Task<McpResponse> DragAsync() => NotImplementedAsync("browser_drag");

    [McpServerTool("browser_evaluate", "Evaluate script")]
    [Description("Evaluate JavaScript in the page")]
    [McpServerToolType(ToolType.Destructive)]
    public Task<McpResponse> EvaluateAsync() => NotImplementedAsync("browser_evaluate");

    [McpServerTool("browser_file_upload", "Upload file")]
    [Description("Upload a file to an input")]
    [McpServerToolType(ToolType.Destructive)]
    public Task<McpResponse> UploadFileAsync() => NotImplementedAsync("browser_file_upload");

    [McpServerTool("browser_fill_form", "Fill form")]
    [Description("Fill a form field")]
    [McpServerToolType(ToolType.Destructive)]
    public Task<McpResponse> FillFormAsync() => NotImplementedAsync("browser_fill_form");

    [McpServerTool("browser_handle_dialog", "Handle dialog")]
    [Description("Handle browser dialogs")]
    [McpServerToolType(ToolType.Destructive)]
    public Task<McpResponse> HandleDialogAsync() => NotImplementedAsync("browser_handle_dialog");

    [McpServerTool("browser_hover", "Hover element")]
    [Description("Hover an element")]
    [McpServerToolType(ToolType.Destructive)]
    public Task<McpResponse> HoverAsync() => NotImplementedAsync("browser_hover");

    [McpServerTool("browser_select_option", "Select option")]
    [Description("Select option in a form control")]
    [McpServerToolType(ToolType.Destructive)]
    public Task<McpResponse> SelectOptionAsync() => NotImplementedAsync("browser_select_option");

    [McpServerTool("browser_type", "Type text")]
    [Description("Type into an element")]
    [McpServerToolType(ToolType.Destructive)]
    public Task<McpResponse> TypeAsync() => NotImplementedAsync("browser_type");

    [McpServerTool("browser_close", "Close tab")]
    [Description("Close the current tab")]
    [McpServerToolType(ToolType.Destructive)]
    public Task<McpResponse> CloseAsync() => NotImplementedAsync("browser_close");

    [McpServerTool("browser_install", "Install browser")]
    [Description("Install additional browser binaries")]
    [McpServerToolType(ToolType.Destructive)]
    public Task<McpResponse> InstallAsync() => NotImplementedAsync("browser_install");

    [McpServerTool("browser_network_requests", "Inspect network")]
    [Description("Inspect network requests")]
    [McpServerToolType(ToolType.ReadOnly)]
    public Task<McpResponse> NetworkRequestsAsync() => NotImplementedAsync("browser_network_requests");

    [McpServerTool("browser_press_key", "Press key")]
    [Description("Press a key in the page")]
    [McpServerToolType(ToolType.Destructive)]
    public Task<McpResponse> PressKeyAsync() => NotImplementedAsync("browser_press_key");

    [McpServerTool("browser_resize", "Resize page")]
    [Description("Resize the page viewport")]
    [McpServerToolType(ToolType.Destructive)]
    public Task<McpResponse> ResizeAsync() => NotImplementedAsync("browser_resize");

    [McpServerTool("browser_snapshot", "Take snapshot")]
    [Description("Capture a DOM snapshot")]
    [McpServerToolType(ToolType.ReadOnly)]
    public Task<McpResponse> SnapshotAsync() => NotImplementedAsync("browser_snapshot");

    [McpServerTool("browser_tabs", "List tabs")]
    [Description("List open tabs")]
    [McpServerToolType(ToolType.ReadOnly)]
    public Task<McpResponse> TabsAsync() => NotImplementedAsync("browser_tabs");

    [McpServerTool("browser_take_screenshot", "Screenshot")]
    [Description("Capture a screenshot")]
    [McpServerToolType(ToolType.ReadOnly)]
    public Task<McpResponse> ScreenshotAsync() => NotImplementedAsync("browser_take_screenshot");

    [McpServerTool("browser_wait_for", "Wait for")]
    [Description("Wait for a condition")]
    [McpServerToolType(ToolType.Destructive)]
    public Task<McpResponse> WaitForAsync() => NotImplementedAsync("browser_wait_for");

    [McpServerTool("browser_connect", "Connect to browser", RequiresConnectTool = true)]
    [Description("Connect to an existing browser")]
    [McpServerToolType(ToolType.Destructive)]
    public Task<McpResponse> ConnectAsync() => NotImplementedAsync("browser_connect");

    [McpServerTool("browser_pdf_save", "Save PDF", Capability = "pdf")]
    [Description("Save the current page as PDF")]
    [McpServerToolType(ToolType.Destructive)]
    public Task<McpResponse> SavePdfAsync() => NotImplementedAsync("browser_pdf_save");

    [McpServerTool("browser_mouse_move_xy", "Move mouse", Capability = "vision")]
    [Description("Move the mouse using coordinates")]
    [McpServerToolType(ToolType.Destructive)]
    public Task<McpResponse> MoveMouseAsync() => NotImplementedAsync("browser_mouse_move_xy");

    [McpServerTool("browser_mouse_click_xy", "Click mouse", Capability = "vision")]
    [Description("Click using page coordinates")]
    [McpServerToolType(ToolType.Destructive)]
    public Task<McpResponse> MouseClickAsync() => NotImplementedAsync("browser_mouse_click_xy");

    [McpServerTool("browser_mouse_drag_xy", "Drag mouse", Capability = "vision")]
    [Description("Drag using page coordinates")]
    [McpServerToolType(ToolType.Destructive)]
    public Task<McpResponse> MouseDragAsync() => NotImplementedAsync("browser_mouse_drag_xy");

    private static Task<McpResponse> NotImplementedAsync(string name)
    {
        return Task.FromResult(ResponseBuilder.Error($"Tool \"{name}\" is not implemented in the C# server."));
    }

    internal sealed record NavigateArguments(
        [property: Required]
        [property: Description("The URL to navigate to.")]
        string Url
    );

    internal sealed record ClickArguments(
        [property: Required]
        [property: Description("Selector (CSS default; prefix with xpath= for XPath, text= for text)")]
        string Selector
    );
}
