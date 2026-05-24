# Windows Notes

## Playwright already on this machine

Playwright is installed and used by Python scripts:
- [portfolio-mgmt/scripts/pm-ap-scrape.py](../../portfolio-mgmt/scripts/pm-ap-scrape.py) — AlphaPicks (sequential-only, PX-evasion)
- [portfolio-mgmt/scripts/pm-mccracken-scrape.py](../../portfolio-mgmt/scripts/pm-mccracken-scrape.py) — McCracken
- [api-oracle/scripts/run_pipeline.py](../../api-oracle/scripts/run_pipeline.py) — doc-archive pipeline

These use the Python `playwright` package directly and are **not migrating** to Playwright MCP — the MCP server exposes the same engine to model-driven calls, which is a different use case than deterministic scripted scrape.

## What M1 needs to verify on Windows

- `npx -y @playwright/mcp@latest` runs natively without WSL2 (per upstream README, native Windows + npm should work)
- Browser binaries: whether MCP reuses the Python install's already-downloaded browser cache, or pulls its own under the npm package's path. May need `PLAYWRIGHT_BROWSERS_PATH` env var to share.
- Claude Code picks up the npx-launched process correctly over stdio
- Confirm versions: upstream package is `@playwright/mcp@0.0.75` at fork time, bundles `playwright@1.61.0-alpha-1778188671000`

## Known gotchas

- _none yet — first run is M1_
