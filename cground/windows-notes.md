# Windows Notes

## Playwright already on this machine

Playwright is installed and used by Python scripts:
- [portfolio-mgmt/scripts/pm-ap-scrape.py](../../portfolio-mgmt/scripts/pm-ap-scrape.py) — AlphaPicks (sequential-only, PX-evasion)
- [portfolio-mgmt/scripts/pm-mccracken-scrape.py](../../portfolio-mgmt/scripts/pm-mccracken-scrape.py) — McCracken
- [api-oracle/scripts/run_pipeline.py](../../api-oracle/scripts/run_pipeline.py) — doc-archive pipeline

These use the Python `playwright` package directly and are **not migrating** to Playwright MCP — the MCP server exposes the same engine to model-driven calls, which is a different use case than deterministic scripted scrape.

## M1a findings (2026-05-23)

- `npx -y @playwright/mcp@latest --help` runs natively on Windows without WSL2 — confirmed with Node v24.13.0 and npm/npx 11.15.0.
- npm-latest is `@playwright/mcp@0.0.75`, bundling `playwright@1.61.0-alpha-1778188671000` — same as the upstream pin at fork time, so the fork doesn't drift from `@latest`.
- MCP registered via `claude mcp add --scope user playwright npx -- -y "@playwright/mcp@latest"` → writes to `~/.claude.json` `mcpServers.playwright`.
- Health check via `claude mcp list` returned `playwright: npx -y @playwright/mcp@latest - ✓ Connected`. Stdio handshake works on Windows out of the box.

## Browser cache topology

| Install | Cache path | Notes |
|---|---|---|
| Python Playwright (existing, used by pm-ap-scrape et al.) | `C:\Users\Canno\AppData\Local\ms-playwright\chromium-1217\` (and siblings) | Standard Playwright default location |
| Playwright MCP per-workspace persistent profile | `%USERPROFILE%\AppData\Local\ms-playwright\mcp-{channel}-{workspace-hash}\` | Separate from above. Per upstream README: `{workspace-hash}` is derived from the MCP client's workspace root, so different projects get separate profiles automatically. |

**No cache-sharing config needed.** The MCP-side profile is intentionally separate (per-workspace state), and the chromium browser binary itself is reused from the Playwright install. Setting `PLAYWRIGHT_BROWSERS_PATH` is NOT necessary unless we want to force the MCP to use a different chromium build than its bundled one.

## Concurrent-MCP caveat (for future)

Per upstream README: "A persistent profile can only be used by one browser instance at a time, so concurrent MCP clients sharing the same workspace will conflict. To run several clients in parallel, start each additional client with `--isolated` or point it at a distinct `--user-data-dir`."

Currently we have ONE MCP client (Claude Code in CannonGround) so no conflict. If we ever add a second MCP client (e.g. Cursor or another Claude Code instance for a different repo with the same workspace hash), revisit.

## Known gotchas

- _none yet — first MCP-driven smoke test is M1b, gated on next Claude Code restart_
