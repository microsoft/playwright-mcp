using System.Text.Json.Serialization;

namespace PlaywrightMcpServer.Browser;

internal sealed record ElementInfo(
    [property: JsonPropertyName("ref")] string Ref,
    [property: JsonPropertyName("role")] string Role,
    [property: JsonPropertyName("name")] string? Name,
    [property: JsonPropertyName("text")] string? Text,
    [property: JsonPropertyName("active")] bool Active
);

internal sealed record SnapshotResult(
    [property: JsonPropertyName("title")] string Title,
    [property: JsonPropertyName("url")] string Url,
    [property: JsonPropertyName("elements")] ElementInfo[] Elements
);

internal sealed record PageSnapshot(string Url, string Title, IReadOnlyList<ElementInfo> Elements, string Yaml);
