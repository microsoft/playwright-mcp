using PlaywrightMcpServer;

namespace ModelContextProtocol.Server;

[AttributeUsage(AttributeTargets.Method, AllowMultiple = false)]
public sealed class McpServerToolAttribute : Attribute
{
    public McpServerToolAttribute(string name, string title)
    {
        Name = name;
        Title = title;
    }

    public string Name { get; }

    public string Title { get; }

    public string Capability { get; set; } = "core";

    public bool RequiresConnectTool { get; set; }
}

[AttributeUsage(AttributeTargets.Method, AllowMultiple = false)]
public sealed class McpServerToolTypeAttribute : Attribute
{
    public McpServerToolTypeAttribute(ToolType type)
    {
        Type = type;
    }

    public ToolType Type { get; }
}
