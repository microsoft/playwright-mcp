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
- **M1a — wire** (shipped 2026-05-23): registered `playwright` at user scope via `claude mcp add --scope user`. Connection health-check passed.
- **M1b — first MCP-driven smoke** (shipped 2026-05-24): drove `github.com/microsoft/playwright-mcp` head-to-head with Claude-in-Chrome. Tool surface works end-to-end. Findings below + in [cground/migration-targets.md](cground/migration-targets.md).
- **M1c — depth-routing pattern demo (Layer 1)** (shipped 2026-05-24): proved Playwright MCP's built-in `depth` + `target` flags enable a navigate-then-scope pattern with zero extra tooling. Same GitHub page, 4-tier ladder: skeleton (322 B) → article (40 KB) → main (93 KB) → full (99 KB). Pattern works; routing intelligence (which landmark to scope to) is per-page. Evidence YAMLs in [cground/m1c-evidence/](cground/m1c-evidence/).
- **M1d — Layer 2 routing tooling** (queued, next): write `cground/scripts/snapshot-route.py` + `cground/snapshot-routing.yml` that post-processes a snapshot into a manifest + per-zone splits. Bootup-pattern parallel.
- **M2+ — head-to-heads on real "middling" flows** (queued): pick specific Claude-in-Chrome use cases that have been rough, rerun under Playwright MCP, document verdicts.

## M1b head-to-head: Playwright MCP vs Claude-in-Chrome

Same URL (`github.com/microsoft/playwright-mcp`), same task (capture a11y tree of the page), one turn each.

| Dimension | Playwright MCP (`browser_snapshot`) | Claude-in-Chrome (`read_page`) |
|---|---|---|
| **Snapshot delivery** | Written to YAML file on disk (`.playwright-mcp/page-<ts>.yml`); response ≈ 200 tokens (file path + page title) | Inlined in response; ~12,500 chars at `depth=3` (default `max_chars=50000`) |
| **Token cost per call** | Near-zero by default; pay only when you `Read` the file | Full inline always; tune via `depth` + `max_chars` + `ref_id` |
| **A11y tree structure** | Element-type + name + `[ref=eN]` + `[cursor=pointer]` + separate `/url:` lines | Element-type + name + `[ref_N]` + inline `href="..."` + `type="..."` attrs |
| **Click target stability** | `ref=eN` returned by snapshot; pass to `browser_click` | `ref_N` returned by read; pass to click tool |
| **Browser instance** | Spawns its own Chromium under `%LOCALAPPDATA%\ms-playwright\mcp-<channel>-<workspace-hash>\` | Drives Cannon's actual Edge browser via the Chrome extension bridge |
| **Logged-in session** | No — fresh persistent profile per workspace | Yes — your real cookies, GitHub session, etc. |
| **Content text** | In snapshot YAML (must Read file to get) | Inline as short `generic "..."` previews; full text via deeper reads |
| **GitHub lazy widgets** | Both showed `Uh oh! There was an error while loading` zones — equal failure mode | Same |
| **Parallel batching** | Standalone — each tool call separate | `browser_batch` available for chaining clicks/types/screenshots |

**Headline finding**: the file-based-snapshot design is the load-bearing differentiator. Playwright MCP turns a 25k-token a11y snapshot into a 200-token tool response by default. For multi-step browser flows, that's the difference between context exhaustion and comfortable iteration.

**When to reach for each**:
- **Playwright MCP** when: the task doesn't need logged-in Chrome, you want token-efficient multi-step navigation, you need deterministic reproducibility, you're driving the model through a sequence of pages
- **Claude-in-Chrome** when: you need Cannon's real browser session (logged in, real cookies), the page is small and inline read is fine, you want to see Cannon's actual visible tab

## M1c depth-routing pattern (Layer 1, built-in)

Cannon's question after M1b: "if you didn't even need to read the full YAML — if you knew where the content is and where the fluff is — could we skip even that 25k Read cap?" Same problem [bootup.md solves](../c-ground-code/references/bootup/bootup.md) for tier-2 walk dumps via chunk-with-manifest. Playwright MCP has two built-in flags that get us Layer 1 of the answer without any new tooling.

**Pattern**: navigate, then scope.

1. **Call A — skeleton**: `browser_snapshot(depth=2)` → tiny landmark map.
2. **Pick a ref** from the skeleton (`main`, `article`, etc.).
3. **Call B — scoped**: `browser_snapshot(target=<ref>)` → just that zone.

**Live demo on `github.com/microsoft/playwright-mcp`** (evidence: [cground/m1c-evidence/](cground/m1c-evidence/)):

| Approach | Filename | Lines | Bytes | ≈ Tokens | Notes |
|---|---|---|---|---|---|
| Skeleton (`depth=2`) | `m1c-skeleton.yml` | 10 | 322 | ~80 | Surfaces `banner [ref=e6]` / `main [ref=e62]` / `contentinfo [ref=e1287]` |
| Article (`target=article` CSS) | `m1c-article.yml` | 570 | 40,215 | ~10k | README content only — comfortably under Read's 25k-token cap |
| Main scoped (`target=e62`) | `m1c-main.yml` | 1,302 | 92,924 | ~23k | GitHub stuffs file tree + sidebar inside `main`, so main is over-broad here |
| Full unfiltered (default) | `page-<ts>.yml` | 1,384 | 99,420 | ~25k | M1b baseline |

**Headline finding**: routing to the **right** landmark is the win. On GitHub, `article` cuts to ~10k tokens (60% smaller, well under Read cap). On `main` it only shaved ~6KB because GitHub's main contains the whole app. So Layer 1 works but agent intelligence about WHICH landmark to scope per-page-type is the real load-bearing piece. That's what Layer 2 (M1d) pre-encodes.

**Layer 1 gotchas surfaced**:
- The `filename` param resolves **cwd-relative**, not snapshot-dir-relative. `filename="foo.yml"` lands in CG root, NOT `.playwright-mcp/`. To keep ephemeral artifacts gitignored, either prefix with `.playwright-mcp/` or accept they'll need moving/cleaning.
- `target` accepts both `[ref=eN]` references AND CSS selectors (`article`, `[role=main]`, etc.). CSS is the more portable default; refs change across snapshots.

## Upstream info

- Package: `@playwright/mcp` v0.0.75 (npm)
- MCP name: `io.github.microsoft/playwright-mcp`
- License: Apache 2.0
- Node: >=18
- Browsers: bundled via Playwright 1.61.0-alpha

## History

- **2026-05-23 — M0**: Forked microsoft/playwright-mcp → CannonWest/playwright-connector. Cloned to `~/CannonGround/playwright-connector/`. `cground` branch created. CANNONGROUND.md + `cground/` scaffolding written. Upstream push disabled as safety latch. Pushed to `origin/cground` (commit `a7c5d14`).
- **2026-05-23 — M1a**: Verified `npx -y @playwright/mcp@latest --help` runs natively on Windows (Node v24.13.0, npm/npx 11.15.0). Located Microsoft's recommended install path in upstream README. Registered MCP server at user scope: `claude mcp add --scope user playwright npx -- -y @playwright/mcp@latest`. `claude mcp list` health-check returned `playwright: npx -y @playwright/mcp@latest - ✓ Connected`. Tool surface gated on next Claude Code session restart (M1b).
- **2026-05-24 — M1b**: Cannon restarted Claude Code; 23 `mcp__playwright__browser_*` tools surfaced as expected. Side-by-side vs Claude-in-Chrome on `github.com/microsoft/playwright-mcp` (appropriately recursive target): both produced usable a11y trees with stable refs. Playwright MCP snapshot landed as `1,384 lines / 99,420 bytes` (~25k tokens) but in a YAML file at `.playwright-mcp/page-2026-05-24T21-50-41-872Z.yml` (already gitignored via `/.playwright-mcp` in CG root). Tool response was ~200 tokens. Claude-in-Chrome's `read_page` at `depth=3 max_chars=15000` returned 12,500 chars inline. File-based-snapshot design is the major differentiator — full table in head-to-head section above.
- **2026-05-24 — M1c**: Demo'd Layer 1 of the routing pattern Cannon proposed in reaction to M1b: use built-in `depth` + `target` flags to navigate-then-scope. Same URL, 4-tier ladder captured as evidence: skeleton (322 B) → article (40 KB) → main (93 KB) → full (99 KB). The article-scoped snapshot is the right hop for GitHub repo pages (40 KB / ~10k tokens, comfortably under Read cap). Main is over-broad because GitHub's main element is the whole app. Lesson: routing intelligence (which landmark to scope per-page-type) IS the load-bearing piece; Layer 1 only exposes the lever. Layer 2 (M1d) pre-encodes the routing decision per domain.
