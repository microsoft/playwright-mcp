# Migration Targets

Running list of Claude-in-Chrome / Claude-Preview / other browser-surface use cases evaluated for migration to Playwright MCP. Updated as M2+ head-to-heads happen.

| Use case | Current surface | Verdict | Notes |
|---|---|---|---|
| Read a GitHub repo README (smoke test) | both | Playwright MCP wins on token economy (200-token response vs 12.5k inline) | M1b 2026-05-24. Both produced usable a11y trees; the file-based snapshot is the differentiator. See [`../CANNONGROUND.md` head-to-head table](../CANNONGROUND.md). |
| `pm-bravos-sync` daily research crawl | migrating Claude-in-Chrome → Playwright MCP | Playwright MCP wins; auth bridge via persistent profile | **PBPM arc** — M0 ratified 2026-05-24; M1+M1.5+M2+M2.5+M3+M3.5+M3.6+M3.7 fire-1/3s shipped 5/24-5/25 (parsers for atoms 1+2+3, 4, 5, 6, 9, 10, 11). Fires 2/3+3/3 + M4 + M5 + M-integrate queued. Driving briefing: [`c-ground-code/runway/pm-bravos-playwright-migration.md`](../../c-ground-code/runway/pm-bravos-playwright-migration.md). |
| `koyfin-midday-snapshot` + `market-snapshot` browser dance | Playwright MCP (migration complete 2026-05-26) | Playwright MCP wins; fix-of-broken (Edge background-throttle stalls Claude-in-Chrome scrape during EOD) | **KPW arc — CLOSED 2026-05-26.** Full M0→M4 timeline in ~30 hours: M0 auth bridge 5/25; M1 NDV extractor + M2 CSV download (fires 1/3 5/25 Memorial Day, fires 2/3 5/26 open-market, fire 3/3 skipped per Cannon's call); M3a midday-snapshot v1.10→v1.11 + M3b market-snapshot v1.0→v1.1 5/26; M4 ceremonial bump to v2.0 5/26. Both routines Playwright-only. Auth-probe heartbeat: `koyfin-watchlist/scripts/koyfin_auth_probe.py`. Driving briefing: [`c-ground-code/runway/koyfin-playwright-migration.md`](../../c-ground-code/runway/koyfin-playwright-migration.md). |

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

## Depth-routing pattern (from M1c)

When the snapshot YAML approaches Read's 25k-token cap (which it routinely does on content-rich pages), use Playwright MCP's built-in `depth` + `target` flags to navigate-then-scope:

1. `browser_snapshot(depth=2, filename=".playwright-mcp/skeleton.yml")` → tiny landmark map (~10 lines on GitHub).
2. Read the skeleton, pick the right landmark for the page type.
3. `browser_snapshot(target=<ref-or-css>, filename=".playwright-mcp/scoped.yml")` → just that zone.

**Routing rule of thumb (working list, extend as we hit new sites)**:

| Site type | Recommended scope | Why |
|---|---|---|
| GitHub repo pages | `target=article` (CSS) | Main is whole app; article is the README |
| News articles / blogs | `target=article` (CSS) | Standard semantic element |
| Most landing pages | `target=main` (CSS or ref) | Standard primary content landmark |
| Web apps (Gmail, Notion) | Per-app investigation needed | Landmarks often unreliable; may need deeper navigation |

Layer 2 (M1d) will pre-encode these rules in `cground/snapshot-routing.yml` so the routing decision isn't reinvented per session.
