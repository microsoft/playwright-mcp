using System.Text.Json;

namespace PlaywrightMcpServer;

internal sealed class CommandLineOptions
{
    private readonly HashSet<string> _capabilities = new(StringComparer.OrdinalIgnoreCase);

    private CommandLineOptions()
    {
    }

    public bool Headless { get; private set; } = true;

    public string BrowserName { get; private set; } = "chrome";

    public bool IncludeConnectTool { get; private set; }

    public IReadOnlyCollection<string> Capabilities => _capabilities;

    public static CommandLineOptions Parse(IEnumerable<string> args)
    {
        var options = new CommandLineOptions();
        foreach (var raw in args)
        {
            var arg = raw ?? string.Empty;
            if (arg.Equals("--headless", StringComparison.OrdinalIgnoreCase))
            {
                options.Headless = true;
            }
            else if (arg.Equals("--headed", StringComparison.OrdinalIgnoreCase))
            {
                options.Headless = false;
            }
            else if (arg.Equals("--connect-tool", StringComparison.OrdinalIgnoreCase))
            {
                options.IncludeConnectTool = true;
            }
            else if (arg.Equals("--vision", StringComparison.OrdinalIgnoreCase))
            {
                options._capabilities.Add("vision");
            }
            else if (arg.StartsWith("--browser=", StringComparison.OrdinalIgnoreCase))
            {
                options.BrowserName = arg[("--browser=".Length)..];
            }
            else if (arg.StartsWith("--caps=", StringComparison.OrdinalIgnoreCase))
            {
                var value = arg[("--caps=".Length)..];
                foreach (var capability in value.Split(',', StringSplitOptions.RemoveEmptyEntries))
                    options._capabilities.Add(capability.Trim());
            }
            else if (arg.StartsWith("--config=", StringComparison.OrdinalIgnoreCase))
            {
                var configPath = arg[("--config=".Length)..];
                options.ApplyConfiguration(configPath);
            }
            else
            {
                // Ignore unsupported switches such as --no-sandbox
            }
        }
        return options;
    }

    private void ApplyConfiguration(string path)
    {
        if (string.IsNullOrWhiteSpace(path))
            return;
        try
        {
            var fullPath = Path.GetFullPath(path);
            if (!File.Exists(fullPath))
                return;
            using var document = JsonDocument.Parse(File.ReadAllText(fullPath));
            var root = document.RootElement;
            if (root.TryGetProperty("capabilities", out var capabilitiesElement) && capabilitiesElement.ValueKind == JsonValueKind.Array)
            {
                foreach (var item in capabilitiesElement.EnumerateArray())
                {
                    if (item.ValueKind == JsonValueKind.String)
                        _capabilities.Add(item.GetString()!);
                }
            }
            if (root.TryGetProperty("browser", out var browserElement))
            {
                if (browserElement.TryGetProperty("browserName", out var browserNameElement) && browserNameElement.ValueKind == JsonValueKind.String)
                    BrowserName = browserNameElement.GetString() ?? BrowserName;
                if (browserElement.TryGetProperty("launchOptions", out var launchElement) && launchElement.ValueKind == JsonValueKind.Object)
                {
                    if (launchElement.TryGetProperty("headless", out var headlessElement))
                    {
                        Headless = headlessElement.ValueKind switch
                        {
                            JsonValueKind.True => true,
                            JsonValueKind.False => false,
                            _ => Headless
                        };
                    }
                }
            }
        }
        catch
        {
            // Ignore configuration parsing errors to avoid crashing the server on malformed input.
        }
    }
}
