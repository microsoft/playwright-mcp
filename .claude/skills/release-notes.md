---
name: release-notes
description: Prepare GitHub release notes for playwright-mcp by combining changes from this repo and upstream microsoft/playwright since the last release.
---

# Preparing Release Notes

Most MCP source lives upstream at `~/playwright/packages/playwright-core/src/tools/` (and `tests/mcp/`). Release notes need to combine changes from both repos.

## 1. Find the cutoff

```bash
# Last published release and its date
gh release list --repo microsoft/playwright-mcp --limit 5

# Format reference — use the most recent non-trivial release
gh release view v0.0.69 --repo microsoft/playwright-mcp

# Playwright version that shipped in the last release
git show <release-commit>:package.json | grep -E '"playwright|"@playwright"'
# Convert the alpha timestamp to a UTC date for the upstream log filter
date -r <timestamp_seconds> -u
```

## 2. Collect changes

```bash
# Upstream playwright (MCP code path widened to catch tools/cli/dashboard too)
cd ~/playwright
git log --since="<UTC date>" --oneline -- packages/playwright-core/src/tools/

# This repo
cd -
git log <last-release-commit>..HEAD --oneline
```

Filter for `feat(mcp)`, `fix(mcp)`, `feat(extension)`, `fix(extension)`. Many extension PRs land in *both* repos because the extension source lives upstream now — prefer the `microsoft/playwright` PR link. Use `git show <sha> --stat` to disambiguate when a commit subject is ambiguous.

## 3. Write `release-notes.md`

Follow the format from the prior release: `## What's New` (with `### New Tools`, `### Tool Improvements`, optional `### Browser Extension`, `### Other Changes`) and `## Bug Fixes`. Link each entry to its PR (`[#NNNNN](https://github.com/microsoft/playwright/pull/NNNNN)` or the playwright-mcp equivalent). Skip purely internal refactors, dep bumps, repo layout changes, and anything not user-visible. **Do not mention features that are not yet enabled by default** — confirm with the user before listing experimental flags.

## 4. Create draft release

```bash
gh release create v0.0.<next> --repo microsoft/playwright-mcp \
  --draft --title "v0.0.<next>" --target main \
  --notes-file release-notes.md
```
