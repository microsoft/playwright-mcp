# M1c Evidence Artifacts

These three YAML files are concrete evidence of the depth-routing pattern documented in [`../../CANNONGROUND.md`](../../CANNONGROUND.md) § M1c.

All three are snapshots of `https://github.com/microsoft/playwright-mcp` captured 2026-05-24, using different `depth` / `target` combinations to demonstrate the size delta.

| File | Approach | Lines | Bytes | ≈ Tokens |
|---|---|---|---|---|
| `m1c-skeleton.yml` | `browser_snapshot(depth=2)` | 10 | 322 | ~80 |
| `m1c-article.yml` | `browser_snapshot(target="article")` (CSS selector) | 570 | 40,215 | ~10k |
| `m1c-main.yml` | `browser_snapshot(target="e62")` (main landmark ref) | 1,302 | 92,924 | ~23k |

Compared baseline (NOT included here; lives in `.playwright-mcp/` and is gitignored):
- Full unfiltered snapshot: 1,384 lines / 99,420 bytes / ~25k tokens.

**Why we keep these committed**: small, frozen examples make the routing-pattern story falsifiable. When M1d (`snapshot-route.py`) gets built, these are the regression inputs we test it against. If a future Playwright MCP upgrade changes the snapshot format, these break visibly.

**Why they're under `cground/`** and not in `.playwright-mcp/` (the gitignored ephemeral dir): these are documented evidence, not runtime artifacts. The `cground/` subdir is the "CG-only files, never PR'd upstream" zone — exactly the right home.
