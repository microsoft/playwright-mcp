using System.Text;

namespace PlaywrightMcpServer.Browser;

internal static class SnapshotFormatter
{
    public static string BuildYaml(IReadOnlyList<ElementInfo> elements)
    {
        if (elements.Count == 0)
            return string.Empty;

        var builder = new StringBuilder();
        for (var i = 0; i < elements.Count; i++)
        {
            var element = elements[i];
            if (i > 0)
                builder.AppendLine();
            builder.Append("- ");
            builder.Append(BuildLabel(element));
            if (element.Active)
                builder.Append(" [active]");
            builder.Append(' ');
            builder.Append("[ref=");
            builder.Append(element.Ref);
            builder.Append(']');
            if (!string.IsNullOrEmpty(element.Text))
            {
                builder.Append(": ");
                builder.Append(element.Text);
            }
        }
        return builder.ToString();
    }

    private static string BuildLabel(ElementInfo element)
    {
        var role = string.IsNullOrEmpty(element.Role) ? "generic" : element.Role;
        if (!string.IsNullOrEmpty(element.Name) && NeedsQuotedName(role))
            return $"{role} \"{EscapeQuotes(element.Name!)}\"";
        return role;
    }

    private static bool NeedsQuotedName(string role)
    {
        return role is "button" or "link" or "textbox" or "combobox";
    }

    private static string EscapeQuotes(string value)
    {
        return value.Replace("\"", "\\\"");
    }
}
