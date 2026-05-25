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
- **M1d — Layer 2 routing tooling** (shipped 2026-05-24): [`cground/snapshot-routing.yml`](cground/snapshot-routing.yml) (URL-pattern → target rules, 10 routes covering GitHub, Medium, Substack, NYT, MDN, SO + default) and [`cground/scripts/snapshot-route.py`](cground/scripts/snapshot-route.py) (CLI that prints the recommended target for a URL). Smoke-tested: GitHub repo→article, GitHub PR→main, GitHub issue→main, example.com→main, Medium→article. Bug surfaced during testing (fnmatch's `*` matches across slashes, broad rules shadowed specific ones) and fixed by reordering + documenting in the config header.
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

## Layer 2 usage: `snapshot-route.py` (M1d)

When a `browser_snapshot` YAML is over Read's 25k-token cap, get the recommended scope target before calling browser_snapshot a second time:

```bash
target=$(python cground/playwright-connector/cground/scripts/snapshot-route.py "$URL")
# then: browser_snapshot(target="$target", filename=".playwright-mcp/scoped.yml")
```

The script reads [`cground/snapshot-routing.yml`](cground/snapshot-routing.yml) — pre-encoded URL-pattern → target rules. Edit the YAML to extend; smoke-test by re-running the script against representative URLs.

Bootup-pattern parallel: [`bootup.py`](../c-ground-code/scripts/bootup.py) pre-encodes `TARGET_MEMORY_MAP` so each session doesn't reinvent which memory file goes with which target; `snapshot-routing.yml` pre-encodes which landmark goes with which URL pattern so each session doesn't reinvent that either. Both move the routing decision from agent willpower to environment.

## PBPM consumer: `bravos_research_parse.py`

`cground/scripts/bravos_research_parse.py` is the first downstream consumer script — parses Bravos `/research/` page output (atoms 1+2+3 of the `pm-bravos-sync` routine) from a Playwright MCP `browser_evaluate(filename=...)` extract. Emits the canonical v1.6 `ati-snapshot` body + tactical-signal snapshot + latest-posts slug list. Shipped during **PBPM-M1** (2026-05-24) as part of the routine's migration from Claude-in-Chrome MCP.

Usage:

```bash
# Step 1 in routine (browser_evaluate captures innerText + post-links to disk):
#   await browser_evaluate({
#     filename: '.playwright-mcp/bravos-research-extract.json',
#     function: '() => ({ full_text: document.body.innerText, post_links: ... })'
#   })

# Step 2 (parser turns it into canonical atoms):
python cground/scripts/bravos_research_parse.py \
  --extract-path .playwright-mcp/bravos-research-extract.json \
  --snapshot-date-et 2026-05-24
```

The parser intentionally stays a **pure extractor** — it surfaces only what's on the page. PBPM-M1's parallel-run validation confirms structural parity on all load-bearing fields against the 2026-05-24 Claude-in-Chrome truth-set: 7/7 tactical-signal fields, 8/8 ATI aggregate fields, 18/18 positions match on (symbol/weight/asset_class/action), 17/18 company names exact match, 16/16 latest-posts slugs covered.

## PBPM enrichment: `bravos_enrich_ati_picked.py`

The `/research/` page renders Active Trade Ideas without per-position pick dates; those live on the separate `/ideas/` page (atom 11). `cground/scripts/bravos_enrich_ati_picked.py` joins the two on ticker symbol so parser output can be promoted to the truth-set shape downstream consumers (CannonAI Bravos overlay etc.) read. Shipped **PBPM-M1.5** (2026-05-24) as the picked-date enrichment landing.

```bash
# Step 3 in routine (after parse, before bravos_write_artifact):
python cground/scripts/bravos_enrich_ati_picked.py \
  --ati-path .playwright-mcp/parsed-ati.json \
  --ideas-archive-path portfolio-mgmt/data/research/bravos/ideas-archive/2026-05-24.json \
  > .playwright-mcp/enriched-ati.json
```

Design ratification: option (d) — same-day ideas-archive cross-ref — empirically dominated three alternatives:

| Option | Mechanism | Coverage | Cost |
|---|---|---|---|
| **(d) [shipped]** | Cross-ref same-day `/ideas/` atom (already captured) | 18/18 on 2026-05-24 (incl. ALUM 2025-12-19, pre-routine) | zero — pure join on symbol |
| (a) | Per-position `browser_hover` for tooltip | unknown — depends on Bravos UI surfacing dates | 18 extra browser calls per fire |
| (b) | Post-hoc cross-ref from `trade-alerts/` archive | gap for pre-2026-04-29 positions (archive's earliest date) | builds attribution map |
| (c) | Accept null + drop from v1.6 schema | n/a — drops the field | loses information |

End-to-end pipeline parity (parse + enrich vs 2026-05-24 truth): aggregate 8/8 · per-position load-bearing+picked 18/18 · per-position EXACT-ALL incl. company 17/18 (ALUM "Aluminum" vs truth "Aluminum ETF" — Bravos source data has no ETF suffix on either page; agent canonicalization added it. Low-pri polish via a ticker→company-name canonicalization map; symbol is load-bearing).

Enricher is source-agnostic — works against Claude-in-Chrome's existing ideas-archive output today, drops in seamlessly once M2 lands the Playwright-MCP atom-11 extractor.

Full PBPM arc + per-milestone status lives at [`c-ground-code/runway/pm-bravos-playwright-migration.md`](../c-ground-code/runway/pm-bravos-playwright-migration.md).

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
- **2026-05-24 — M1d**: Shipped Layer 2 tooling. `cground/snapshot-routing.yml` holds the URL-pattern → target rules (10 routes: GitHub repo/PR/issue/gist/search, Medium, Substack, NYT, MDN, SO, plus default `main`). `cground/scripts/snapshot-route.py` is the CLI lookup. Bug surfaced during smoke testing: fnmatch's `*` matches across slashes, so broad rules shadowed specific ones — reordered + documented in config header. Smoke-tested against 5 URLs (GitHub repo→article ✓, PR→main ✓, issue→main ✓, example.com→main ✓, Medium→article ✓). Bootup-pattern parallel: routing decision moves from agent willpower to environment, same shape as `TARGET_MEMORY_MAP` in bootup.py.
- **2026-05-24 — PBPM-M0 (downstream)**: pm-bravos-sync routine ratified Candidate A (Playwright MCP's persistent profile) as the auth bridge. Both A and the C alternative (`--cdp-endpoint` + dedicated Edge with `--user-data-dir`) verified empirically — both persisted Bravos auth across browser close + relaunch when the user-data-dir was stable. A wins on operational simplicity (zero launch ceremony for autonomous fires). C kept as ad-hoc debug tool (launch dedicated Edge + drive via Python `connect_over_cdp` from a scratch script, no MCP-config thrash). Full ratification + spike evidence: [`cground-skills#562`](https://github.com/CannonWest/cground-skills/pull/562). Persistent-profile auth-persistence finding is now in `project_playwright_connector` memory as a generic substrate fact.
- **2026-05-24 — PBPM-M1 fire 1/3 (downstream)**: shipped `cground/scripts/bravos_research_parse.py` — the first downstream consumer script. Parses Bravos `/research/` (atoms 1+2+3 of `pm-bravos-sync`) from a Playwright MCP `browser_evaluate` extract; emits the canonical v1.6 `ati-snapshot` body + tactical-signal snapshot + latest-posts slug list. Parallel-run validation against 2026-05-24 Claude-in-Chrome truth-set: structural parity 100% on all load-bearing fields (signal/positions/weights/asset_class/slugs); 17/18 company-name exact match after tightening the `_company_titlecase` heuristic with explicit KEEP_UPPER + BRAND_CASE_MAP (ProShares/iShares/VanEck etc.). Two by-design divergences (`picked` date enrichment + ALUM "ETF" suffix) are agent-inference, not parser concerns. Used `browser_evaluate(filename=...)` to skip `browser_snapshot` entirely; no Bravos rule needed in `snapshot-routing.yml` yet (deferred to M2 when atom 11 `/ideas/` gets snapshot-scoping). Fires 2/3 and 3/3 happen on subsequent pm-bravos-sync runs; on 3/3 clean, M2 lifts the parser into the routine's daily flow.
- **2026-05-24 — PBPM-M1.5 (downstream)**: shipped `cground/scripts/bravos_enrich_ati_picked.py` — closes the picked-date divergence from M1 fire 1/3. Joins parser-emitted ATI on same-day ideas-archive by ticker symbol. Empirical: 18/18 picked dates match between truth-set ATI and truth-set ideas-archive on 2026-05-24 — including ALUM (picked 2025-12-19, pre-routine-archive). Option (d) chosen empirically over (a)/(b)/(c) without firing an AskUserQuestion (rubber-stamp — empirical proof made the OQ trivial; per `feedback_runway_use_ask_user_question.md` "default-don't-ask exceptions"). Enricher is source-agnostic — joins on canonical ideas-archive shape regardless of upstream provenance, so it works against Claude-in-Chrome's atom-11 output today AND M2's eventual Playwright-MCP atom-11 extractor. End-to-end pipeline parity (parse + enrich vs truth): 8/8 aggregate · 18/18 load-bearing+picked · 17/18 EXACT-ALL incl. company (ALUM ETF-suffix remains, agent-canonicalization not on the page).
