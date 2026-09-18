---
name: release
description: Prepare a playwright-mcp release — roll Playwright, bump the version, and open a `chore: mark v0.0.<next>` PR whose body IS the release notes (changes from this repo and upstream microsoft/playwright since the last release).
---

# Preparing a Release

A release is a `chore: mark v0.0.<next>` commit whose **PR body is the release notes**. There is a single PR — the version bump and the notes ship together. Most MCP source lives upstream at `~/playwright/packages/playwright-core/src/tools/` (and `tests/mcp/`), so the notes draw from both this repo and upstream.

## 1. Roll Playwright

Follow the "Rolling Playwright" steps in `CLAUDE.md`: run `node roll.js`, branch as `roll-pw-<version-suffix>`, run `npm test`, and open a `chore: roll Playwright to <version>` PR. **Wait for it to merge into `main`** before proceeding.

## 2. Bump the version

```bash
git checkout main && git pull
git checkout -b mark-v0.0.<next>
# Bump "version" in package.json, package-lock.json (both occurrences), and server.json (both occurrences)
```

Do NOT open the PR yet — its body must be the release notes, so write those first (steps 3–5).

## 3. Find the exact commit window

The reliable boundary is the **`gitHead` of each published alpha build**, not a fuzzy date window (date windows double-count commits that land on the boundary day — e.g. a commit written on the previous release's build date but not actually in that build).

```bash
# Playwright version pinned by the previous release (last "mark v" commit) and by this release
git log --oneline | grep "mark v" | head -1
git show <prev-release-sha>:package.json | grep '"playwright":'   # baseline alpha
grep '"playwright":' package.json                                 # new alpha (already rolled)

# Resolve each alpha to the exact upstream commit it was built from
npm view playwright-core@<baseline-alpha> gitHead   # e.g. -> 287ad476...
npm view playwright-core@<new-alpha> gitHead         # e.g. -> a061d963...
```

The window is `<baseline-gitHead>..<new-gitHead>`.

## 4. Collect changes

```bash
# Upstream playwright — MCP code path widened to catch tools/extension/dashboard too
cd ~/playwright
git log <baseline-gitHead>..<new-gitHead> --reverse --pretty='%h %s' -- \
  packages/playwright-core/src/tools/ packages/playwright-core/src/extension/ tests/mcp/

# This repo
cd -
git log <prev-release-sha>..HEAD --oneline
```

Filter for `feat(mcp)`, `fix(mcp)`, `feat(extension)`, `fix(extension)`, `feat(aria)` snapshot changes, and dashboard changes. Many extension PRs land in *both* repos because the extension source lives upstream now — prefer the `microsoft/playwright` PR link. Use `git show <sha> --stat` to disambiguate ambiguous subjects.

**Drop:** test-only changes, docs, `chore(deps)`, CLI-daemon internals with no MCP-facing effect, reverted commits, and anything not user-visible. **Verify membership** of boundary commits with `git merge-base --is-ancestor <sha> <gitHead>` — a commit can be listed in the previous release's notes yet not actually be in that build; if it was already announced, do not repeat it.

## 5. Write `release-notes.md`

Follow the format from the prior release (`gh pr view <prev-PR> --repo microsoft/playwright-mcp --json body -q .body`; v0.0.82, [#1764](https://github.com/microsoft/playwright-mcp/pull/1764), is the reference). **No top-level `#` header** — the PR title is the heading. Three sections:

````markdown
## ✨ Highlights

- **<emoji> Short headline** ([microsoft/playwright#<issue>](https://github.com/microsoft/playwright/issues/<issue>)) — <what the user could not do before>. <What is new: the tool with its parameters, or `--option` (config `key`, env `PLAYWRIGHT_MCP_KEY`)>. ([microsoft/playwright#<pr>](https://github.com/microsoft/playwright/pull/<pr>))

## 🐛 Fixes

- `<commit subject>` — <user-visible effect, naming the tool> ([microsoft/playwright#<issue>](https://github.com/microsoft/playwright/issues/<issue>)). ([microsoft/playwright#<pr>](https://github.com/microsoft/playwright/pull/<pr>))

## 📦 Upgrading

Configs that use `@playwright/mcp@latest` pick this release up on the next client restart. To pin it:

```bash
npx @playwright/mcp@0.0.<next>
```
````

- **Highlights** — one bullet per feature, most exciting first, each with its own emoji. Lead with the motivation (the linked issue, when there is one; omit the issue link otherwise), then what is new. New tools, tool improvements, options, extension and dashboard changes all go here. Fold follow-up PRs into the feature they extend (e.g. a `browser_find` enhancement joins the `browser_find` bullet).
- **Fixes** — start with the commit subject in backticks, then say what changes for the user. Reword the subject when it does not match what landed.
- Link PRs as `[microsoft/playwright#NNNNN](https://github.com/microsoft/playwright/pull/NNNNN)`, or `[#NNNN](https://github.com/microsoft/playwright-mcp/pull/NNNN)` for this repo.

Wording rules:
- Only list things that change user-visible behavior.
- **Describe what landed, not what the PR description says** — read the diff (`git show <sha>`). Descriptions go stale during review: parts get dropped, behavior changes (e.g. "ignores" became "returns an error").
- **Do not mention features that are not enabled by default** — confirm with the user before listing experimental flags. A fix to an opt-in tool can be listed when annotated, e.g. `browser_route` (opt-in via `--caps=network`).
- When a release removes or replaces something announced earlier, say so in the bullet of the feature that replaces it.

## 6. Commit, push, open the PR with the notes as its body

```bash
git commit -am "chore: mark v0.0.<next>"
git push -u origin mark-v0.0.<next>
gh pr create --repo microsoft/playwright-mcp --head <user>:mark-v0.0.<next> \
  --base main \
  --title "chore: mark v0.0.<next>" \
  --body-file release-notes.md
```

The PR body is the release notes verbatim — no `#` header, no filename, nothing else.

## Pitfalls

- **Don't open the version-bump PR with a placeholder body** and backfill later — write the notes first so the PR is created with them.
- **Don't use a date window** for the upstream diff — use the `gitHead` range. Dates double-count boundary-day commits.
- **Don't re-announce** a commit that already appeared in the previous release's notes; check ancestry with `git merge-base --is-ancestor`.
- **Don't include a `#` header** in the PR body — GitHub renders the PR title already.
