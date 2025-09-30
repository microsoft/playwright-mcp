using System.Text;
using PlaywrightMcpServer.Browser;

namespace PlaywrightMcpServer;

internal sealed class McpResponse
{
    private readonly List<object> _content = new();

    public bool IsError { get; set; }

    public IList<object> Content => _content;

    public object ToResult()
    {
        return new
        {
            content = _content.ToArray(),
            isError = IsError
        };
    }
}

internal static class ResponseBuilder
{
    public static McpResponse Success(string code, PageSnapshot snapshot, string? result = null)
    {
        var builder = new StringBuilder();
        if (!string.IsNullOrEmpty(result))
        {
            builder.AppendLine("### Result");
            builder.AppendLine(result);
            builder.AppendLine();
        }

        builder.AppendLine("### Ran Playwright code");
        builder.AppendLine("```js");
        builder.AppendLine(code);
        builder.AppendLine("```");
        builder.AppendLine();

        builder.AppendLine("### Page state");
        builder.AppendLine($"- Page URL: {snapshot.Url}");
        builder.AppendLine($"- Page Title: {snapshot.Title}");
        builder.AppendLine("- Page Snapshot:");
        builder.AppendLine("```yaml");
        if (!string.IsNullOrEmpty(snapshot.Yaml))
            builder.AppendLine(snapshot.Yaml);
        else
            builder.AppendLine("<empty>");
        builder.AppendLine("```");

        var response = new McpResponse();
        response.Content.Add(new { type = "text", text = builder.ToString().TrimEnd() });
        return response;
    }

    public static McpResponse Error(string message)
    {
        var response = new McpResponse { IsError = true };
        var builder = new StringBuilder();
        builder.AppendLine("### Result");
        builder.AppendLine(message);
        response.Content.Add(new { type = "text", text = builder.ToString().TrimEnd() });
        return response;
    }

    public static string EscapeJavaScript(string value)
    {
        var builder = new StringBuilder(value.Length + 8);
        foreach (var ch in value)
        {
            builder.Append(ch switch
            {
                '\\' => "\\\\",
                '\'' => "\\'",
                '"' => "\\\"",
                '\n' => "\\n",
                '\r' => "\\r",
                '\t' => "\\t",
                _ => ch.ToString()
            });
        }
        return builder.ToString();
    }
}
