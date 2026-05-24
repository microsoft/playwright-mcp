# Migration Targets

Running list of Claude-in-Chrome / Claude-Preview / other browser-surface use cases evaluated for migration to Playwright MCP. Updated as M2+ head-to-heads happen.

| Use case | Current surface | Verdict | Notes |
|---|---|---|---|
| _none yet_ | — | — | First entries land in M2 |

## What we WON'T migrate (already decided in M0)

- **pm-ap-scrape** — PX-evasion timing is encoded in the Python script; sequential-only constraint locked in by memory.
- **pm-mccracken-scrape** — same reason.
- **api-oracle Playwright pipeline** — runs as a script, not a model-driven flow.

## Evaluation rubric

- **Does the task need model judgment mid-flow?** If yes, MCP wins. If no (deterministic scrape), stay on Python.
- **Does it need a logged-in real Chrome session?** If yes, Claude-in-Chrome wins (drives your actual browser). If no, Playwright MCP wins.
- **Is it dev-server preview / UI verification?** Claude-Preview is purpose-built; keep there.
- **Repeatability requirement?** Playwright MCP's a11y-snapshot approach is more deterministic than vision-based control.
