using System.Text;

namespace PlaywrightMcpServer;

internal static class Program
{
    public static async Task Main(string[] args)
    {
        Console.InputEncoding = Encoding.UTF8;
        Console.OutputEncoding = new UTF8Encoding(encoderShouldEmitUTF8Identifier: false);

        var options = CommandLineOptions.Parse(args);
        var server = new McpServer(options);
        await server.RunAsync();
    }
}
