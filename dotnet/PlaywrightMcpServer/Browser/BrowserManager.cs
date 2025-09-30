using Microsoft.Playwright;

namespace PlaywrightMcpServer.Browser;

internal sealed class BrowserManager : IAsyncDisposable
{
    private readonly CommandLineOptions _options;

    private IPlaywright? _playwright;
    private IBrowser? _browser;
    private IBrowserContext? _context;
    private IPage? _page;

    private IReadOnlyList<ElementInfo> _orderedElements = Array.Empty<ElementInfo>();
    private readonly Dictionary<string, ElementInfo> _elementsByRef = new(StringComparer.OrdinalIgnoreCase);

    private const string SnapshotScript = """
(() => {
  if (!document.body) {
    return { title: document.title, url: document.location.href, elements: [] };
  }
  for (const el of document.querySelectorAll('[data-mcp-ref]')) {
    el.removeAttribute('data-mcp-ref');
  }
  const elements = [];
  let counter = 0;
  const isInteractive = (el, role) => {
    return role === 'button' || role === 'link' || role === 'textbox' || role === 'checkbox' || role === 'radio' || role === 'combobox';
  };
  const computeRole = el => {
    const explicitRole = el.getAttribute('role');
    if (explicitRole)
      return explicitRole;
    const tag = el.tagName.toLowerCase();
    if (tag === 'a')
      return 'link';
    if (tag === 'button')
      return 'button';
    if (tag === 'select')
      return 'combobox';
    if (tag === 'textarea')
      return 'textbox';
    if (tag === 'input') {
      const type = (el.getAttribute('type') || 'text').toLowerCase();
      if (type === 'checkbox')
        return 'checkbox';
      if (type === 'radio')
        return 'radio';
      if (type === 'button' || type === 'submit' || type === 'reset')
        return 'button';
      return 'textbox';
    }
    return 'generic';
  };
  const computeName = (el, role) => {
    const ariaLabel = el.getAttribute('aria-label');
    if (ariaLabel)
      return ariaLabel.trim();
    const ariaLabelledBy = el.getAttribute('aria-labelledby');
    if (ariaLabelledBy) {
      const labels = ariaLabelledBy.split(/\s+/)
        .map(id => document.getElementById(id))
        .filter(Boolean)
        .map(el => el.innerText ? el.innerText.trim() : '')
        .filter(Boolean);
      if (labels.length)
        return labels.join(' ');
    }
    if (role === 'button' || role === 'link') {
      const text = el.innerText?.trim();
      if (text)
        return text;
    }
    if (role === 'textbox') {
      const placeholder = el.getAttribute('placeholder');
      if (placeholder)
        return placeholder.trim();
    }
    return null;
  };
  const computeText = el => {
    const value = el.innerText ? el.innerText.trim().replace(/\s+/g, ' ') : '';
    return value || null;
  };
  const shouldInclude = (el, role, text) => {
    if (el === document.body)
      return text !== null;
    return isInteractive(el, role) || text !== null;
  };
  const pushElement = el => {
    if (!(el instanceof HTMLElement))
      return;
    const role = computeRole(el);
    const text = computeText(el);
    if (!shouldInclude(el, role, text))
      return;
    const name = computeName(el, role);
    const ref = `e${++counter}`;
    el.setAttribute('data-mcp-ref', ref);
    elements.push({
      ref,
      role,
      name: name ?? null,
      text: text ?? null,
      active: document.activeElement === el
    });
  };
  pushElement(document.body);
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (node === document.body)
      continue;
    pushElement(node);
  }
  return {
    title: document.title,
    url: document.location.href,
    elements
  };
})()
""";

    public BrowserManager(CommandLineOptions options)
    {
        _options = options;
    }

    public async Task NavigateAsync(string url, CancellationToken cancellationToken = default)
    {
        var page = await EnsurePageAsync(cancellationToken);
        await page.GotoAsync(url, new PageGotoOptions { WaitUntil = WaitUntilState.DOMContentLoaded });
        await WaitForSettledAsync(page);
    }

    public async Task ClickAsync(ElementInfo element, CancellationToken cancellationToken = default)
    {
        var page = await EnsurePageAsync(cancellationToken);
        var locator = page.Locator($"[data-mcp-ref=\"{element.Ref}\"]");
        await locator.ClickAsync(new LocatorClickOptions { Timeout = 10000 });
        await WaitForSettledAsync(page);
    }

    public string BuildClickSnippet(ElementInfo element)
    {
        if (element.Role == "button" && !string.IsNullOrEmpty(element.Name))
            return $"await page.getByRole('button', {{ name: '{EscapeSingleQuoted(element.Name!)}' }}).click();";
        if (element.Role == "link" && !string.IsNullOrEmpty(element.Name))
            return $"await page.getByRole('link', {{ name: '{EscapeSingleQuoted(element.Name!)}' }}).click();";
        return $"await page.locator('[data-mcp-ref=\"{element.Ref}\"]').click();";
    }

    public async Task<PageSnapshot> CaptureSnapshotAsync(CancellationToken cancellationToken = default)
    {
        var page = await EnsurePageAsync(cancellationToken);
        SnapshotResult? result = null;
        try
        {
            result = await page.EvaluateAsync<SnapshotResult>(SnapshotScript);
        }
        catch (PlaywrightException)
        {
            // Ignore evaluation errors and fall back to empty snapshot.
        }

        var elements = result?.Elements ?? Array.Empty<ElementInfo>();
        _orderedElements = elements;
        _elementsByRef.Clear();
        foreach (var element in elements)
            _elementsByRef[element.Ref] = element;

        var yaml = SnapshotFormatter.BuildYaml(_orderedElements);
        var url = result?.Url ?? page.Url;
        var title = result?.Title ?? await page.TitleAsync();
        return new PageSnapshot(url, title, _orderedElements, yaml);
    }

    public bool TryGetElement(string refId, out ElementInfo element)
    {
        return _elementsByRef.TryGetValue(refId, out element!);
    }

    public async ValueTask DisposeAsync()
    {
        if (_page != null)
        {
            try { await _page.CloseAsync(); } catch { }
            _page = null;
        }
        if (_context != null)
        {
            try { await _context.CloseAsync(); } catch { }
            _context = null;
        }
        if (_browser != null)
        {
            try { await _browser.CloseAsync(); } catch { }
            _browser = null;
        }
        if (_playwright != null)
        {
            try { await _playwright.DisposeAsync(); } catch { }
            _playwright = null;
        }
    }

    private async Task<IPage> EnsurePageAsync(CancellationToken cancellationToken)
    {
        if (_page != null)
            return _page;
        await EnsureContextAsync(cancellationToken);
        _page = await _context!.NewPageAsync();
        return _page;
    }

    private async Task EnsureContextAsync(CancellationToken cancellationToken)
    {
        if (_context != null)
            return;
        _playwright ??= await Playwright.CreateAsync();
        var browserType = ResolveBrowserType(_playwright, _options.BrowserName);
        var launchOptions = new BrowserTypeLaunchOptions
        {
            Headless = _options.Headless
        };
        if (_options.BrowserName is "chrome" or "msedge")
            launchOptions.Channel = _options.BrowserName;
        _browser = await browserType.LaunchAsync(launchOptions);
        _context = await _browser.NewContextAsync();
    }

    private static IBrowserType ResolveBrowserType(IPlaywright playwright, string browserName)
    {
        return browserName?.ToLowerInvariant() switch
        {
            "chromium" => playwright.Chromium,
            "chrome" => playwright.Chromium,
            "msedge" => playwright.Chromium,
            "firefox" => playwright.Firefox,
            "webkit" => playwright.Webkit,
            _ => playwright.Chromium
        };
    }

    private static async Task WaitForSettledAsync(IPage page)
    {
        try
        {
            await page.WaitForLoadStateAsync(LoadState.NetworkIdle, new PageWaitForLoadStateOptions { Timeout = 3000 });
        }
        catch (PlaywrightException)
        {
            // Ignore timeouts.
        }
        await page.WaitForTimeoutAsync(300);
    }

    private static string EscapeSingleQuoted(string value)
    {
        var builder = new System.Text.StringBuilder(value.Length + 8);
        foreach (var ch in value)
        {
            builder.Append(ch switch
            {
                '\\' => "\\\\",
                '\'' => "\\'",
                '\n' => "\\n",
                '\r' => "\\r",
                '\t' => "\\t",
                _ => ch.ToString()
            });
        }
        return builder.ToString();
    }
}
