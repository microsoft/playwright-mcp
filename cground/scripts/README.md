# `cground/scripts/` — CannonGround Layer 2 tooling

CG-only scripts that layer on top of upstream Playwright MCP. None of these
are PR'd upstream; they encode CG-specific routing/conventions.

## `snapshot-route.py`

**Purpose**: when a `browser_snapshot` YAML approaches Read's 25k-token cap,
recommend a `target` value for a SECOND scoped snapshot.

**Usage**:
```bash
python cground/scripts/snapshot-route.py <url>
```

Prints a single line (e.g. `article` or `main`). Pass that to:
```
browser_snapshot(target=<output>, filename=".playwright-mcp/scoped.yml")
```

**Where rules live**: [`../snapshot-routing.yml`](../snapshot-routing.yml). Edit
that file to add or change routes. Rules are evaluated top-to-bottom; first
match wins. **More-specific rules must appear above less-specific ones** —
fnmatch's `*` matches across slashes greedily.

**Smoke test**:
```bash
python cground/scripts/snapshot-route.py "https://github.com/microsoft/playwright-mcp"   # → article
python cground/scripts/snapshot-route.py "https://github.com/microsoft/playwright-mcp/pull/859"  # → main
python cground/scripts/snapshot-route.py "https://example.com/"                          # → main (default)
```

**Dependencies**: Python 3.10+ (uses `str | None` union syntax), PyYAML.
