# Migration Targets

Running list of Claude-in-Chrome / Claude-Preview / other browser-surface use cases evaluated for migration to Playwright MCP. Updated as M2+ head-to-heads happen.

| Use case | Current surface | Verdict | Notes |
|---|---|---|---|
| Read a GitHub repo README (smoke test) | both | Playwright MCP wins on token economy (200-token response vs 12.5k inline) | M1b 2026-05-24. Both produced usable a11y trees; the file-based snapshot is the differentiator. See [`../CANNONGROUND.md` head-to-head table](../CANNONGROUND.md). |

## What we WON'T migrate (already decided in M0)

- **pm-ap-scrape** — PX-evasion timing is encoded in the Python script; sequential-only constraint locked in by memory.
- **pm-mccracken-scrape** — same reason.
- **api-oracle Playwright pipeline** — runs as a script, not a model-driven flow.

## Evaluation rubric (updated post-M1b)

1. **Does it need a logged-in real Chrome session?** → Claude-in-Chrome wins (drives Cannon's actual Edge/Chrome via the extension bridge).
2. **Is it dev-server preview / UI verification?** → Claude-Preview is purpose-built; keep there.
3. **Will the model need to do multi-step navigation through several pages?** → Playwright MCP wins. The file-based-snapshot default keeps the context window from filling up with a11y trees you don't need to keep in working memory.
4. **Does the task need model judgment mid-flow?** → MCP wins (either one). If no, stay on Python.
5. **Repeatability requirement?** → Both a11y-snapshot approaches are deterministic; either MCP beats vision-based control.

## Token-economy note (from M1b)

For a GitHub-scale page, Playwright MCP's tool response is ~200 tokens (file path) vs Claude-in-Chrome's ~12,500 chars inline (at `depth=3 max_chars=15000`). The Playwright snapshot YAML itself is ~25k tokens — but it lives on disk and you only spend the context when you `Read` it. For multi-page flows, this difference compounds significantly. Plan migrations accordingly: if a Claude-in-Chrome flow is filling up context with `read_page` results, that's a strong Playwright MCP migration signal.
