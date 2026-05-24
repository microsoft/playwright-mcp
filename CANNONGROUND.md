# playwright-connector — CannonGround Tracking

CannonWest fork of [microsoft/playwright-mcp](https://github.com/microsoft/playwright-mcp). Upstream is the official Playwright team's MCP server exposing browser automation as model-callable tools.

## Why we forked

Strategic alignment, **not patch-driven** (no CannonGround-specific patches at fork time). Reasons:

1. **AI-agnostic surface** — Playwright MCP works with any MCP client (Claude Code, Cursor, Windsurf, Claude Desktop, etc.). Matches CannonGround's posture of not tying the substrate to one model vendor. Claude-in-Chrome is Anthropic-only.
2. **Better-maintained upstream** — Microsoft, actively shipping. v0.0.75 as of fork time, 32.9k stars, last upstream commit < 24h before fork.
3. **Structured a11y snapshots** — no vision model required, deterministic DOM-based interaction. Cheaper + more predictable than screenshot+vision flow.
4. **Replaces middling-results surfaces** — Claude-in-Chrome and Claude-Preview have rough edges on some flows. Playwright is battle-tested for serious automation.

## Repo layout

- **`main` branch** — clean mirror of `upstream/main` (microsoft/playwright-mcp). **Never commit CannonGround content here.**
- **`cground` branch** — our integration branch. CG-specific files live in [`CANNONGROUND.md`](CANNONGROUND.md) (this file) and the [`cground/`](cground/) subdirectory.
- **`cground/`** — all CannonGround-only files (notes, configs, migration plans). Never PR'd upstream.

## Remotes

- `origin` → `https://github.com/CannonWest/playwright-connector.git` (our fork, push enabled)
- `upstream` → `https://github.com/microsoft/playwright-mcp.git` (fetch only; push URL set to `DISABLED_NO_PUSH_TO_MICROSOFT` as safety latch)

To pull upstream changes:
```bash
git fetch upstream
git checkout main
git merge upstream/main --ff-only
git push origin main
git checkout cground
git merge main   # bring upstream changes into integration branch
```

## Install state in CannonGround

- **Wired into MCP config 2026-05-23 (M1a).** Registered at user scope in `~/.claude.json` via `claude mcp add --scope user playwright npx -- -y @playwright/mcp@latest`. Connection verified — health check returned `✓ Connected` on first call. Tools become callable in the next Claude Code session (MCP servers register at session-start, not hot-reload).
- **Runtime versions on this machine**: Node v24.13.0, npm/npx 11.15.0, `@playwright/mcp@0.0.75` (= upstream latest = our fork pin — no drift).
- **Playwright already installed** for the Python-driven scrapers ([portfolio-mgmt/scripts/pm-ap-scrape.py](../portfolio-mgmt/scripts/pm-ap-scrape.py), [pm-mccracken-scrape.py](../portfolio-mgmt/scripts/pm-mccracken-scrape.py), [api-oracle/scripts/run_pipeline.py](../api-oracle/scripts/run_pipeline.py)). The MCP uses the same Playwright engine but maintains its own profile at `%USERPROFILE%\AppData\Local\ms-playwright\mcp-{channel}-{workspace-hash}` (separate from the Python install's browser cache at `C:\Users\Canno\AppData\Local\ms-playwright\chromium-1217\` et al). No cache-sharing config needed in M1a — see [cground/windows-notes.md](cground/windows-notes.md).

## Existing surfaces this coexists with

| Surface | Type | Use case | Verdict |
|---|---|---|---|
| Claude-in-Chrome | Anthropic MCP | Interactive browser, real Chrome session, logged-in flows | Coexists; Playwright MCP candidate to replace for headless/scripted flows |
| Claude-Preview | Claude Code built-in | Dev-server preview, UI verification | Coexists; preview is dev-loop specific |
| pm-ap-scrape (Python Playwright) | Direct Python | AlphaPicks scraping, PX-evasion-disciplined, sequential-only | Stays put — MCP doesn't help; scripts encode bot-block timing |
| pm-mccracken-scrape | Direct Python | McCracken scraper | Stays put |
| api-oracle Apify + Playwright fallback | Direct Python | Doc-archive pipeline | Stays put |

## Milestones

- **M0 — substrate** (shipped 2026-05-23): fork + clone + scaffolding. Commit on `cground` branch, pushed to origin.
- **M1a — wire** (shipped 2026-05-23): registered `playwright` at user scope via `claude mcp add --scope user`. Connection health-check passed. Tool surface unavailable in current session until restart (MCP loads at session-start).
- **M1b — first MCP-driven smoke** (queued, requires Cannon to restart Claude Code): use Playwright MCP tools on one page, document the call shape + initial impressions vs Claude-in-Chrome.
- **M2+ — head-to-heads** (queued): rerun real "middling" Claude-in-Chrome moments under Playwright MCP, document verdicts in [cground/migration-targets.md](cground/migration-targets.md).

## Upstream info

- Package: `@playwright/mcp` v0.0.75 (npm)
- MCP name: `io.github.microsoft/playwright-mcp`
- License: Apache 2.0
- Node: >=18
- Browsers: bundled via Playwright 1.61.0-alpha

## History

- **2026-05-23 — M0**: Forked microsoft/playwright-mcp → CannonWest/playwright-connector. Cloned to `~/CannonGround/playwright-connector/`. `cground` branch created. CANNONGROUND.md + `cground/` scaffolding written. Upstream push disabled as safety latch. Pushed to `origin/cground` (commit `a7c5d14`).
- **2026-05-23 — M1a**: Verified `npx -y @playwright/mcp@latest --help` runs natively on Windows (Node v24.13.0, npm/npx 11.15.0). Located Microsoft's recommended install path in upstream README. Registered MCP server at user scope: `claude mcp add --scope user playwright npx -- -y @playwright/mcp@latest`. `claude mcp list` health-check returned `playwright: npx -y @playwright/mcp@latest - ✓ Connected`. Tool surface gated on next Claude Code session restart (M1b).
