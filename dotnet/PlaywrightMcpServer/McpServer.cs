using System.Text.Json;
using System.Text.Json.Serialization;

namespace PlaywrightMcpServer;

internal sealed class McpServer : IAsyncDisposable
{
    private static readonly JsonElement EmptyId = JsonDocument.Parse("0").RootElement;

    private readonly CommandLineOptions _options;
    private readonly BrowserManager _browserManager;
    private readonly ToolRegistry _toolRegistry;
    private readonly JsonSerializerOptions _serializerOptions;

    public McpServer(CommandLineOptions options)
    {
        _options = options;
        _browserManager = new BrowserManager(options);
        _toolRegistry = new ToolRegistry(options, _browserManager);
        _serializerOptions = new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
        };
    }

    public async Task RunAsync()
    {
        string? line;
        while ((line = await Console.In.ReadLineAsync()) != null)
        {
            if (string.IsNullOrWhiteSpace(line))
                continue;
            try
            {
                await HandleMessageAsync(line);
            }
            catch (Exception ex)
            {
                await WriteErrorAsync(EmptyId, -32603, $"Internal error: {ex.Message}");
            }
        }

        await DisposeAsync();
    }

    private async Task HandleMessageAsync(string json)
    {
        using var document = JsonDocument.Parse(json);
        var root = document.RootElement;
        if (!root.TryGetProperty("method", out var methodElement))
            return;
        var method = methodElement.GetString() ?? string.Empty;
        if (root.TryGetProperty("id", out var idElement))
        {
            var parameters = root.TryGetProperty("params", out var paramsElement) ? paramsElement : (JsonElement?)null;
            await HandleRequestAsync(method, idElement, parameters);
        }
        else
        {
            var parameters = root.TryGetProperty("params", out var paramsElement) ? paramsElement : (JsonElement?)null;
            await HandleNotificationAsync(method, parameters);
        }
    }

    private async Task HandleRequestAsync(string method, JsonElement id, JsonElement? parameters)
    {
        switch (method)
        {
            case "initialize":
                var initializeResult = new
                {
                    protocolVersion = "2025-06-18",
                    capabilities = new { tools = new { } },
                    serverInfo = new { name = "Playwright MCP (.NET)", version = "0.1.0" }
                };
                await WriteResultAsync(id, initializeResult);
                break;
            case "ping":
                await WriteResultAsync(id, new { });
                break;
            case "roots/list":
                await WriteResultAsync(id, new { roots = Array.Empty<object>() });
                break;
            case "tools/list":
                var tools = _toolRegistry.ListTools();
                await WriteResultAsync(id, new { tools });
                break;
            case "tools/call":
                if (parameters is not { ValueKind: JsonValueKind.Object } callParams)
                {
                    await WriteResultAsync(id, ResponseBuilder.Error("Invalid parameters for tools/call.").ToResult());
                    break;
                }
                if (!callParams.TryGetProperty("name", out var nameElement) || nameElement.ValueKind != JsonValueKind.String)
                {
                    await WriteResultAsync(id, ResponseBuilder.Error("Tool name is required.").ToResult());
                    break;
                }
                var toolName = nameElement.GetString() ?? string.Empty;
                JsonElement? arguments = null;
                if (callParams.TryGetProperty("arguments", out var argsElement) && argsElement.ValueKind != JsonValueKind.Null)
                    arguments = argsElement;
                var response = await _toolRegistry.CallToolAsync(toolName, arguments);
                await WriteResultAsync(id, response.ToResult());
                break;
            default:
                await WriteErrorAsync(id, -32601, $"Method '{method}' not found");
                break;
        }
    }

    private Task HandleNotificationAsync(string method, JsonElement? parameters)
    {
        // The reference implementation does not rely on notifications at the moment.
        return Task.CompletedTask;
    }

    private async Task WriteResultAsync(JsonElement id, object result)
    {
        await WriteMessageAsync(id, writer =>
        {
            writer.WritePropertyName("result");
            JsonSerializer.Serialize(writer, result, _serializerOptions);
        });
    }

    private async Task WriteErrorAsync(JsonElement id, int code, string message)
    {
        await WriteMessageAsync(id, writer =>
        {
            writer.WritePropertyName("error");
            writer.WriteStartObject();
            writer.WriteNumber("code", code);
            writer.WriteString("message", message);
            writer.WriteEndObject();
        });
    }

    private static async Task WriteMessageAsync(JsonElement id, Action<Utf8JsonWriter> writePayload)
    {
        using var buffer = new MemoryStream();
        using (var writer = new Utf8JsonWriter(buffer))
        {
            writer.WriteStartObject();
            writer.WriteString("jsonrpc", "2.0");
            writer.WritePropertyName("id");
            id.WriteTo(writer);
            writePayload(writer);
            writer.WriteEndObject();
        }
        buffer.WriteByte((byte)'\n');
        await Console.Out.BaseStream.WriteAsync(buffer.ToArray());
        await Console.Out.FlushAsync();
    }

    public async ValueTask DisposeAsync()
    {
        await _browserManager.DisposeAsync();
    }
}
