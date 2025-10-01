using System.ComponentModel;
using System.ComponentModel.DataAnnotations;
using System.Reflection;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading;
using ModelContextProtocol.Server;
using PlaywrightMcpServer.Browser;

namespace PlaywrightMcpServer;

internal sealed class ToolRegistry
{
    private readonly CommandLineOptions _options;
    private readonly JsonSerializerOptions _serializerOptions;
    private readonly List<ToolDefinition> _tools = new();
    private readonly Dictionary<string, ToolDefinition> _toolMap = new(StringComparer.Ordinal);

    public ToolRegistry(CommandLineOptions options, BrowserManager browserManager)
    {
        _options = options;
        _serializerOptions = new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
        };

        var providers = new object[]
        {
            new BrowserTools(browserManager)
        };

        foreach (var provider in providers)
        {
            foreach (var tool in AttributeToolDescriptor.Create(provider, _serializerOptions, options))
            {
                AddTool(tool);
            }
        }
    }

    public IReadOnlyList<object> ListTools() => _tools.Select(tool => tool.ToJson()).ToArray();

    public async Task<McpResponse> CallToolAsync(string name, JsonElement? arguments)
    {
        if (!_toolMap.TryGetValue(name, out var tool))
            return ResponseBuilder.Error($"Tool \"{name}\" not found");
        if (tool.Handler is null)
            return ResponseBuilder.Error($"Tool \"{name}\" is not implemented in this server.");
        return await tool.Handler(arguments);
    }

    private void AddTool(ToolDefinition tool)
    {
        if (_toolMap.ContainsKey(tool.Name))
            return;
        _toolMap[tool.Name] = tool;
        _tools.Add(tool);
    }
}

internal enum ToolType
{
    Destructive,
    ReadOnly
}

internal sealed class ToolDefinition
{
    public ToolDefinition(string name, string title, string description, ToolType type, string capability, object inputSchema, Func<JsonElement?, Task<McpResponse>>? handler)
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

internal static class AttributeToolDescriptor
{
    public static IEnumerable<ToolDefinition> Create(object provider, JsonSerializerOptions serializerOptions, CommandLineOptions options)
    {
        var methods = provider.GetType().GetMethods(BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic)
            .Where(method => method.GetCustomAttribute<McpServerToolAttribute>() is not null);

        foreach (var method in methods)
        {
            var toolAttribute = method.GetCustomAttribute<McpServerToolAttribute>()!;
            if (!ShouldIncludeTool(toolAttribute, options))
                continue;

            var typeAttribute = method.GetCustomAttribute<McpServerToolTypeAttribute>();
            var description = method.GetCustomAttribute<DescriptionAttribute>()?.Description ?? toolAttribute.Title;
            var inputSchema = BuildInputSchema(method);
            var handler = BuildHandler(provider, method, serializerOptions);

            yield return new ToolDefinition(
                toolAttribute.Name,
                toolAttribute.Title,
                description,
                typeAttribute?.Type ?? ToolType.Destructive,
                toolAttribute.Capability,
                inputSchema,
                handler
            );
        }
    }

    private static bool ShouldIncludeTool(McpServerToolAttribute attribute, CommandLineOptions options)
    {
        if (attribute.RequiresConnectTool && !options.IncludeConnectTool)
            return false;
        if (!string.Equals(attribute.Capability, "core", StringComparison.OrdinalIgnoreCase) && !options.Capabilities.Contains(attribute.Capability))
            return false;
        return true;
    }

    private static object BuildInputSchema(MethodInfo method)
    {
        var parameters = method.GetParameters()
            .Where(parameter => parameter.ParameterType != typeof(CancellationToken))
            .ToArray();

        if (parameters.Length == 0)
        {
            return new
            {
                type = "object",
                properties = new Dictionary<string, object>(),
                required = Array.Empty<string>()
            };
        }

        if (parameters.Length > 1)
        {
            throw new InvalidOperationException($"Tool method '{method.Name}' can declare at most one argument parameter.");
        }

        var parameterType = parameters[0].ParameterType;
        var properties = new Dictionary<string, object>();
        var required = new List<string>();

        foreach (var property in parameterType.GetProperties(BindingFlags.Instance | BindingFlags.Public))
        {
            if (!property.CanRead)
                continue;

            var propertyName = ToCamelCase(property.Name);
            var schema = new Dictionary<string, object>();
            var (type, format) = ResolveSchemaType(property.PropertyType);
            schema["type"] = type;
            if (format is not null)
                schema["format"] = format;
            var description = property.GetCustomAttribute<DescriptionAttribute>()?.Description;
            if (!string.IsNullOrWhiteSpace(description))
                schema["description"] = description;

            properties[propertyName] = schema;

            if (IsRequired(property))
                required.Add(propertyName);
        }

        return new
        {
            type = "object",
            properties,
            required = required.ToArray()
        };
    }

    private static bool IsRequired(PropertyInfo property)
    {
        if (property.GetCustomAttribute<RequiredAttribute>() is not null)
            return true;
        var propertyType = property.PropertyType;
        if (propertyType.IsValueType)
            return Nullable.GetUnderlyingType(propertyType) is null;
        return false;
    }

    private static (string Type, string? Format) ResolveSchemaType(Type type)
    {
        var underlying = Nullable.GetUnderlyingType(type) ?? type;
        if (underlying == typeof(string))
            return ("string", null);
        if (underlying == typeof(bool))
            return ("boolean", null);
        if (underlying == typeof(int) || underlying == typeof(long))
            return ("integer", null);
        if (underlying == typeof(float) || underlying == typeof(double) || underlying == typeof(decimal))
            return ("number", null);
        if (underlying.IsEnum)
            return ("string", null);
        throw new InvalidOperationException($"Unsupported property type '{underlying.Name}' for tool schema.");
    }

    private static Func<JsonElement?, Task<McpResponse>> BuildHandler(object provider, MethodInfo method, JsonSerializerOptions serializerOptions)
    {
        return async arguments =>
        {
            object?[] invocationArguments;
            try
            {
                invocationArguments = CreateInvocationArguments(method, arguments, serializerOptions);
            }
            catch (ValidationException ex)
            {
                return ResponseBuilder.Error(ex.Message);
            }
            catch (JsonException)
            {
                return ResponseBuilder.Error($"Invalid arguments for tool '{method.Name}'.");
            }
            catch (InvalidOperationException ex)
            {
                return ResponseBuilder.Error(ex.Message);
            }

            try
            {
                var result = method.Invoke(provider, invocationArguments);
                return await ConvertToResponseAsync(result);
            }
            catch (TargetInvocationException ex) when (ex.InnerException is not null)
            {
                return ResponseBuilder.Error(ex.InnerException.Message);
            }
        };
    }

    private static object?[] CreateInvocationArguments(MethodInfo method, JsonElement? arguments, JsonSerializerOptions serializerOptions)
    {
        var parameterInfos = method.GetParameters();
        var values = new object?[parameterInfos.Length];

        for (var index = 0; index < parameterInfos.Length; index++)
        {
            var parameter = parameterInfos[index];
            if (parameter.ParameterType == typeof(CancellationToken))
            {
                values[index] = CancellationToken.None;
                continue;
            }

            if (arguments is null || arguments.Value.ValueKind == JsonValueKind.Null)
            {
                throw new ValidationException("Tool arguments are required.");
            }

            var model = JsonSerializer.Deserialize(arguments.Value.GetRawText(), parameter.ParameterType, serializerOptions);
            if (model is null)
                throw new ValidationException("Tool arguments are required.");

            ValidateModel(model);
            values[index] = model;
        }

        return values;
    }

    private static void ValidateModel(object model)
    {
        var context = new ValidationContext(model);
        Validator.ValidateObject(model, context, validateAllProperties: true);
    }

    private static async Task<McpResponse> ConvertToResponseAsync(object? result)
    {
        switch (result)
        {
            case McpResponse response:
                return response;
            case Task<McpResponse> task:
                return await task.ConfigureAwait(false);
            case ValueTask<McpResponse> valueTask:
                return await valueTask.ConfigureAwait(false);
            default:
                throw new InvalidOperationException("Tool methods must return McpResponse or Task<McpResponse>.");
        }
    }

    private static string ToCamelCase(string value)
    {
        if (string.IsNullOrEmpty(value) || char.IsLower(value, 0))
            return value;
        return char.ToLowerInvariant(value[0]) + value[1..];
    }
}
