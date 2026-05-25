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

## PBPM atom 11: `bravos_ideas_archive_parse.py`

Sibling parser to `bravos_research_parse.py` — covers atom 11 (`/ideas/`). Same shape: takes a Playwright MCP `browser_evaluate(filename=...)` extract of `document.body.innerText` and parses into the canonical ideas-archive shape (`{snapshot_date_et, active_count, active: [{name,symbol,direction,picked}], closed_by_year: {YYYY: int}}`). Shipped **PBPM-M2 fire 1/3** (2026-05-24).

```bash
python cground/scripts/bravos_ideas_archive_parse.py \
  --extract-path .playwright-mcp/bravos-ideas-extract.json \
  --snapshot-date-et 2026-05-24
```

Parity vs 2026-05-24 truth-set: **18/18 active list exact match** (symbol/direction/picked/company-name all clean — atom 11 doesn't have the ALUM ETF-suffix issue because /ideas/ also renders "Aluminum" with no suffix; the canonicalization Sonnet did was ATI-only).

**Closed-count correction**: parser counts diverge significantly from the existing truth-set's `closed_by_year`:

| Year | Parser (page reality) | Truth (routine seen-set) | Ratio |
|---|---|---|---|
| 2023 | 4 | 3 | dedupe — page has 2 identical `Long Turkish stocks - $TUR - [11/08/2023]` lines |
| 2024 | 100 | 72 | routine seen-set under-count |
| 2025 | 157 | 79 | routine seen-set under-count |
| 2026 | 61 | 19 | routine only saw 19 close-events via news-feed crawl since install |

The page is the authoritative source — Bravos's /ideas/ section literally lists every closed trade. The prior truth-set was a routine-side view ("closures the daily news-feed crawl observed") which under-counts everything that closed before the routine was watching. **Parser SUPERSEDES the previous truth-set on closed_by_year** going forward. Historical pre-migration `closed_by_year` entries should be treated as under-counts of unknown completeness.

**Click-to-expand affordance (used by M2.5)**: each closed-trade row carries `class="title idea-click" data-posts="475453,472447,470623,466678,466217"` — clicking AJAX-loads a sibling `<ul.content>` with the full chronological lineage of related posts (initiating → exposure increases → profit-bookings → close). Example NYT expansion (5 posts spanning 2025-11-06 → 2026-02-04) demonstrates the close-date determines the `closed_by_year` bucket, not the picked-date.

## PBPM atom 11 M2.5 enrichment: active-trade lineages

`bravos_ideas_archive_parse.py` was extended in **PBPM-M2.5** (2026-05-24) to attach related-post lineages per active position. Two new fields per `active[i]`:

| Field | Source | Populated when |
|---|---|---|
| `related_post_ids` | `data-posts` attribute on each `.idea-click` row — comma-separated WordPress post IDs | Always (zero browser cost, just DOM read) |
| `related_posts` | Clicked-state `<ul.content>` sibling — `{date_iso, date_raw, slug, href}` per related post | Only if the extract step ran click-to-expand for active rows |

The extract step's `browser_evaluate` JS is now:

```js
async () => {
  // ... grab full_text + auth_state ...

  // Identify active section via "Closed Trades 2026" boundary (document position)
  const closedHeader = [...document.body.querySelectorAll('*')]
    .find(el => el.children.length === 0 && /^Closed Trades 2026$/.test(el.innerText?.trim()));
  const allIdeaPosts = [...document.querySelectorAll('div.idea_posts')];
  const activePostsDivs = allIdeaPosts.filter(d => elPos(d) < closedHeaderPos);

  const lineages = [];
  for (const div of activePostsDivs) {
    const p = div.querySelector('p.idea-click');
    const titleText = p.innerText;
    const dataPosts = p.getAttribute('data-posts') || '';
    const symbol = titleText.match(/\(\$?([A-Z0-9.\-]+)\)/)?.[1];

    p.click();
    let related_posts = [];
    for (let i = 0; i < 40; i++) {                  // poll ≤4s
      await new Promise(r => setTimeout(r, 100));
      const ul = div.querySelector('ul.content');
      if (ul && ul.querySelectorAll('li').length > 0) {
        related_posts = [...ul.querySelectorAll('li')].map(li => ({
          date_iso: parseISO(li.querySelector('span')?.innerText),
          slug:     li.querySelector('a')?.href.match(/\/news-feed\/([^/?#]+)/)?.[1],
          href:     li.querySelector('a')?.href,
        }));
        break;
      }
    }
    lineages.push({ symbol, related_post_ids: dataPosts.split(',').map(Number), related_posts });
  }
  return { ...basics, full_text: ..., active_lineages: lineages };
}
```

Cost: 18 clicks per fire × ~100ms-1s settle = roughly 5-10s overhead. Acceptable for daily routine.

Validation on 2026-05-24 fire: 18/18 active positions got `related_post_ids` populated AND clicked-resolution `related_posts` populated (counts matched between attribute and clicked state for every position). Newer May 2026 picks have 1 related post (initiation only); older picks have 2-3 (initiation + exposure-increase + profit-booking).

```
ALUM (picked 2025-12-19): 2 posts
  2025-12-19 initiating-long-on-aluminum-alum-breakout
  2026-03-30 booking-partial-profits-on-aluminum-alum-profit-booking
LIN (picked 2026-03-12): 2 posts
  2026-03-12 initiating-long-on-linde-plc-lin-breakout
  2026-05-01 increasing-exposure-to-linde-plc-lin-technical-strength
EWJ (picked 2026-05-08): 1 post
  2026-05-08 initiating-long-on-ishares-msci-japan-etf-ewj-breakout
```

Backward compatible: downstream consumers ignore the new fields if unrecognized. If extract has no `active_lineages` (pre-M2.5 extract step), parser writes `null` for both fields. Closed-trade lineages stay one-time backfill — daily routine fires only click-expand the 18 active rows.

## PBPM per-post-drill atoms: `bravos_news_feed_post_parse.py`

Slug-agnostic parser for `/news-feed/{slug}/` pages — covers atoms 4 (trade-alerts), 5 (premium-videos), 6 (special-reports). Same page shell, different content classes. Shipped **PBPM-M3 fire 1/3** (2026-05-25).

```bash
python cground/scripts/bravos_news_feed_post_parse.py \
  --extract-path .playwright-mcp/news-feed-extract.json
```

Emits `{frontmatter, raw_body_text}` — frontmatter carries deterministic structured fields (type, date, slug, ticker, action, company, title, source_url + action-specific fields), raw_body_text carries footer-stripped page prose. The existing Claude-in-Chrome routine emits an AGENT-DISTILLED body (Sonnet reads page + rewrites polished thesis); this parser is a pure extractor — body distillation stays as a routine-flow concern decided at M3-integrate.

### Action coverage (M3 fire 1/3 + M3.5)

| Action | Status | Fields populated |
|---|---|---|
| Initiating Long / Short | ✅ fully covered (M3 f1) | entry_price, take_profit, stop_loss, weight |
| Closing | ✅ fully covered (M3 f1) | close_price, entry_price, entry_date |
| Booking Partial Profits | ✅ fully covered (M3.5) | event_price, weight_before, weight_after, entry_price, entry_date, (optional) add_price + add_date |
| Increasing Exposure | ✅ fully covered (M3.5) | event_price, weight_before, weight_after, entry_price, entry_date |
| Reducing Exposure | ✅ fully covered (M3.5) | event_price, weight_before, weight_after, entry_price, entry_date, (optional) add_price + add_date |

Validated parity against existing artifacts:
- XLF (initiate, 2026-05-22): **10/10 truth-keyed fields exact match**
- DE (closing, 2026-05-21): **8/8 truth-keyed fields exact match**
- MU (profit-booking, 2026-05-04): **5/5 expected event fields match** (event_price + weight_before/after + entry_price/date)
- CPER (profit-booking, 2026-05-14): **7/7 expected event fields match** (also captures add_price/date)
- LIN (exposure-increase, 2026-05-01): **5/5 expected event fields match**
- DE-reduce (exposure-reduce, 2026-05-20): **7/7 expected event fields match** (also captures add_price/date)

**M3.5 sweep total: 24/24 expected event-action fields match across the 4 event-action examples.**

**Unified schema design**: rather than mirror the truth-set's drift across 8+ per-action price-field names (`exit_price` / `add_price` / `trim_price` / `reduce_price` / `Increase at` / `Trim price` / etc.), M3.5 emits one canonical `event_price` field per event-action atom. The `action` field disambiguates what `event_price` means (trim vs add vs reduce). M-integrate (post fires 3/3) decides whether to alias to action-specific names when writing the final artifact.

### Convention normalization vs existing truth-set

Migration surfaces convention drift in the existing Sonnet-written archives:

| Field | Parser | Truth-set variance |
|---|---|---|
| `type` | always `trade-alert` (kebab-case) | mix: `trade-alert` (XLF) vs `Trade Alert` (CPER) |
| `company` | always emitted from H1 parse | sometimes `name`, sometimes omitted |
| `title` | always emitted | omitted in older atoms |
| `source_url` | always emitted | sometimes omitted (e.g. DE 2026-05-21) |

Parser produces a more consistent and complete frontmatter than the Claude-in-Chrome era atoms.

## PBPM atom 9 macro-reports: `bravos_macro_report_parse.py`

Sibling parser to the news-feed extractor — covers atom 9 (`/the-macro-report/{slug}/`). Shipped **PBPM-M3.6 fire 1/3** (2026-05-25). Page shape distinct enough from `/news-feed/` (no Trade Alert / Premium Video type label, no ticker/action metadata, different date format "Mar 13, 2026") that a separate parser is cleaner than branching the news-feed parser by URL pattern.

```bash
python cground/scripts/bravos_macro_report_parse.py \
  --extract-path .playwright-mcp/macro-report-extract.json
```

Emits `{frontmatter, raw_body_text}` — frontmatter carries:
- `type: "macro-report"`
- `date` (Bravos pub date, parsed from "Mon DD, YYYY" first line of body)
- `slug` (from URL)
- `title` (H1 minus " - Bravos Research" suffix)
- `source_url`

`captured` (routine-side timestamp present in existing truth-set artifacts) stays a routine-flow concern — parser correctly skips it; M-integrate adds at write-time.

Footer-strip cuts at the earliest of `"Subscribing gives you ACCESS to:"`, `"Newsletter Sign Up"`, `"Popular Posts"`, plus the standard comment-thread markers. The first three markers are specific to macro-report subscription-pitch + sidebar boilerplate not present on news-feed posts.

Parity vs 2026-05-07 BBK-M0 truth-set:
- `commodities-have-come-roaring-back-...` (pub 2026-03-13): **3/3** truth-keyed fields exact match
- `the-energy-shock-that-changes-everything` (pub 2026-03-09): **3/3** truth-keyed fields exact match

Plus parser adds `type` + `source_url` consistency wins (truth-set used `**Date:**` / `**Slug:**` / `**Captured:**` bold-key prose without an explicit type tag).

## PBPM atom 10 signal-journal: `bravos_signal_journal_parse.py`

Sibling parser for atom 10 (`/model-signal/{slug}/`) — Bravos's per-entry Tactical Signal change pages. Shipped **PBPM-M3.7 fire 1/3** (2026-05-25).

```bash
python cground/scripts/bravos_signal_journal_parse.py \
  --extract-path .playwright-mcp/signal-journal-extract.json
```

Emits `{frontmatter, raw_body_text}` — frontmatter carries:
- `type: "signal-journal"`
- `date` (pub date from MM/DD/YYYY line at top of body)
- `slug` (from URL)
- `signal` (canonical UPPERCASE: AGGRESSIVE / MODERATE / CASH — pulled from H1 parens `Model Signal (Aggressive)`)
- `previous_signal` (parsed from body "updating today from X to Y" pattern)
- `title` (H1 minus suffix)
- `source_url`

`captured_at` (routine-side timestamp in truth-set) stays a routine-flow concern.

Parity vs truth-set archive:
- `model-signal-aggressive-2` (2026-05-19, MODERATE→AGGRESSIVE): **5/5** truth-keyed fields exact match (value-level; parser uses canonical names `signal`/`previous_signal`/`source_url` where truth-set used `signal`/`previous_signal`/`url`)
- `model-signal-moderate-3` (2026-05-12, CASH→MODERATE): **5/5** truth-keyed fields exact match (value-level; truth-set used different names `signal_to`/`signal_from`/`url`, plus `instrument: QQQ` which parser does not extract — Sonnet pulled that from broader context, not the page)

Truth-set has SIGNIFICANT field-name drift across signal-journal atoms (three documented variants):
1. **moderate-2**: bold-key prose, no YAML at all
2. **moderate-3**: YAML with `signal_from`/`signal_to`/`url`/`instrument`
3. **aggressive-2**: YAML with `signal`/`previous_signal`/`url`

Parser canonicalizes to one shape (`signal`/`previous_signal`/`source_url`). M-integrate decides aliasing if downstream consumers need action-specific or legacy names.

Slug-typo defense: Bravos's archive contains `model-signal-agressive` (single 'g') alongside `model-signal-aggressive`. Parser handles both — slug is read from URL as-is; signal value comes from H1 parens which uses correct spelling.

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
- **2026-05-24 — PBPM-M2 fire 1/3 (downstream)**: shipped `cground/scripts/bravos_ideas_archive_parse.py` — atom 11 (`/ideas/`) Playwright-MCP extractor. Active list 18/18 exact match (incl. company-name — atom 11 doesn't have the ALUM ETF-suffix issue ATI did). **Closed-count CORRECTION**: parser counts (2023=4, 2024=100, 2025=157, 2026=61) supersede truth-set counts (3, 72, 79, 19) — page is the authoritative source; prior truth was a routine-side view that under-counted closures predating the routine's install. Click-to-expand spike confirmed: each closed-trade row has `class="title idea-click" data-posts="..."`; clicking AJAX-loads a sibling `<ul.content>` with the full chronological lineage of related posts (NYT example: 5 posts 2025-11-06 → 2026-02-04, demonstrates close-date determines the closed_by_year bucket not picked-date). The data-posts attribute alone (no click needed) exposes related-post IDs as comma-separated. M2.5 wires click-expand into the routine for active-trade lineages.
- **2026-05-24 — PBPM-M2.5 (downstream)**: extended `bravos_ideas_archive_parse.py` with `related_post_ids` + `related_posts` per active position. The extract step's `browser_evaluate` JS now identifies the Active Trade Ideas section (via "Closed Trades 2026" boundary), iterates each `.idea-click` row, captures the `data-posts` attribute (always — zero browser cost) AND clicks-to-expand + polls for the sibling `<ul.content>` to populate `related_posts: [{date_iso, slug, href}, ...]` (the rich clicked-resolution data). 18/18 active positions captured on 2026-05-24; counts matched between attribute and clicked state for every position. Newer May picks have 1 related post (initiation only); older picks have 2-3. Cost: ~18 clicks × ~100ms-1s settle = ~5-10s per fire. Backward compatible: parser writes null for both fields if extract has no `active_lineages` (pre-M2.5 extract step). Cannon's "you can click to expand too" hint during M2-fire-1/3 spike was the design driver — the click-affordance was sitting on the page the whole time but the existing routine never used it.
- **2026-05-25 — PBPM-M3 fire 1/3 (downstream)**: shipped `cground/scripts/bravos_news_feed_post_parse.py` — slug-agnostic parser for `/news-feed/{slug}/` pages covering atoms 4 (trade-alerts), 5 (premium-videos), 6 (special-reports). Pure extractor — emits `{frontmatter, raw_body_text}`; body distillation stays a routine-flow concern. Initiate-type + closing-type actions fully covered (action-specific structured fields like entry_price, take_profit, stop_loss, weight, close_price, entry_date). Profit-booking + exposure-increase/reduce actions are partially covered (action detected, event-specific fields queued for M3.5). Parity validated against existing trade-alerts archive: **XLF initiate 10/10 truth-keyed fields exact match** + **DE closing 8/8 truth-keyed fields exact match**. CPER profit-booking action detected; M3.5 will extend extraction to cover exit_price / add_price / weight_before+after. Convention normalization surfaced: existing Sonnet-written truth-set has drift between atoms (`type` mixes kebab-case + Title Case, `company` sometimes `name` sometimes omitted, `source_url` sometimes omitted); parser emits a consistent shape. Mid-PR fix: take_profit regex was bleeding the prose-form stop_loss into the take_profit list; restructured to prefer the structured "Take Profit (TP):" bottom-of-post line + sentence-bound the prose fallback. Mixed int/float preservation in take_profit list values (59 + 62 ints; 67.5 float) matches truth's YAML conventions.
- **2026-05-25 — PBPM-M3.5 (downstream)**: extended `bravos_news_feed_post_parse.py` with `extract_event_fields()` — unified extractor for profit-booking + exposure-increase + exposure-reduce action types. Schema expansion: each event-action atom now emits `event_price` + `weight_before` + `weight_after` + (optional) `entry_price`/`entry_date` + (optional) `add_price`/`add_date`. Single `event_price` field replaces the truth-set's drift across 8+ per-action price field names — the `action` field disambiguates what `event_price` means. Validated 24/24 expected fields across 4 examples: MU profit-booking (5/5), CPER profit-booking with add event (7/7), LIN exposure-increase (5/5), DE-reduce exposure-reduce with add event (7/7). Body-pattern variants accommodated: "trimming our position in X at $P, and reducing the weight allocation from WB to WA" (MU/DE), "increasing our position in X at $P, and increasing our weight allocation from WB to WA" (LIN), "trimming our position in X at $P, reducing the position from a weight of WB to WA" (CPER). Also tightened the company-name H1 strip to handle "Increasing Exposure to X" / "Reducing Exposure to X" / "Booking Partial Profits on X" prefix patterns that survive the action-keyword strip. And tightened the entry-reference regex to tolerate the optional comma between year and "at" ("April 22, 2026, at $461.59").
- **2026-05-25 — PBPM-M3.6 fire 1/3 (downstream)**: shipped `cground/scripts/bravos_macro_report_parse.py` — sibling parser for atom 9 (`/the-macro-report/{slug}/`). Page shape distinct enough from `/news-feed/` (no Trade Alert / Premium Video type label, no ticker/action metadata, different date format "Mar 13, 2026") that a separate parser is cleaner than branching the news-feed parser by URL pattern. Emits `{frontmatter, raw_body_text}` with frontmatter: `type=macro-report` + `date` (parsed from "Mon DD, YYYY" first line) + `slug` + `title` + `source_url`. Footer-strip cuts at earliest of "Subscribing gives you ACCESS to:" / "Newsletter Sign Up" / "Popular Posts" / standard comment-thread markers — first three are macro-report-specific subscription-pitch + sidebar boilerplate. Parity vs 2026-05-07 BBK-M0 truth-set: 3/3 truth-keyed fields exact on `commodities-have-come-roaring-back-...` + 3/3 exact on `the-energy-shock-that-changes-everything`. Parser adds `type` + `source_url` (consistency wins over truth's `**Date:**`/`**Slug:**`/`**Captured:**` bold-key prose). `captured` field correctly skipped — routine-side timestamp added at M-integrate write-time.
- **2026-05-25 — PBPM-M3.7 fire 1/3 (downstream)**: shipped `cground/scripts/bravos_signal_journal_parse.py` — sibling parser for atom 10 (`/model-signal/{slug}/`). Per-entry Tactical Signal change pages. Frontmatter: `type=signal-journal` + `date` (MM/DD/YYYY pub line) + `slug` (from URL) + `signal` (canonical UPPERCASE from H1 parens) + `previous_signal` (parsed from body "updating today from X to Y" pattern) + `title` + `source_url`. Parity vs truth-set: 5/5 truth-keyed value-level match on `model-signal-aggressive-2` (2026-05-19, MODERATE→AGGRESSIVE) + 5/5 on `model-signal-moderate-3` (2026-05-12, CASH→MODERATE). Truth-set has THREE documented field-name variants across signal-journal atoms (bold-key prose vs YAML with `signal_from`/`signal_to` vs YAML with `signal`/`previous_signal`); parser canonicalizes to one shape. Slug-typo defense: Bravos's archive carries `model-signal-agressive` (single 'g') alongside the correct spelling — parser reads slug from URL as-is; signal value from H1 (correct spelling). Closes the M3 per-post-drill arc on the parser side: atoms 4/5/6 + 9 + 10 all covered. M4 (atom 12 public YT) + M-integrate remain.
