---
name: playwright-triage
description: Triage and fix one microsoft/playwright-mcp issue, or do a maintainer's task, unattended inside the Issue triage GitHub Actions workflow (.github/workflows/triage.yml), which a needs-triage, needs-triage-mac or needs-triage-win label starts, or a maintainer starts by hand with an issue, a task or both. Reproduces the issue on the runner, then leaves a verified fix proposal for the workflow to open as a draft PR, in this repo or in microsoft/playwright where the source of the MCP server is, or an investigation note for it to post on the issue. Only for that workflow.
---

# Playwright MCP Issue Triage

You run unattended in the [Issue triage](../../../.github/workflows/triage.yml) workflow of
`microsoft/playwright-mcp`. First read the shared guide, `$AGENT_GUIDES_DIR/triage.md`, a copy of
[microsoft/playwright/.github/actions/run-agent/guides/triage.md](https://github.com/microsoft/playwright/blob/main/.github/actions/run-agent/guides/triage.md),
and then [CLAUDE.md](../../../CLAUDE.md), both in full. The guide says how to triage an issue in any
Playwright repo. CLAUDE.md says how to build, test and lint this one. This file covers what neither
has: where the code is, the checkouts, how to run a published version, and the outcome that this
repo adds, a fix in `microsoft/playwright`.

## Where the code is

This repo is the npm package `@playwright/mcp`: `cli.js`, `index.js`, the types, the README, the
Dockerfile and some tests of the packaged server. `package.json` pins the alpha of `playwright` and
`playwright-core` that the package runs. The MCP server is in `microsoft/playwright`, in
`packages/playwright-core/src/tools/`: `mcp/` has the server, its config and its command line
options, and `backend/` has the tools. Most bugs and most feature requests are fixed there.

Fix a bug here only when the cause is in a file that this repo owns. These files are copies or
outputs of upstream code, so their fix is upstream too:

- `config.d.ts`: `roll.js` copies it from `packages/playwright-core/src/tools/mcp/config.d.ts`.
- The tools and options in `README.md`: `npm run lint` generates them from the tools.

## The checkouts

`$REPO_DIR` is the checkout of `microsoft/playwright-mcp` that the guide describes. `npm ci` ran in
it, and the browsers of the pinned version are installed. The `chrome` and `msedge` projects use
Google Chrome and Microsoft Edge from the runner image. When one is missing, install it with
`npx playwright install chrome msedge`. The clone is shallow: run
`git fetch --unshallow --tags origin` in it before you need its history.

`$PLAYWRIGHT_DIR` is a clone of `microsoft/playwright` at the tip of `main`, next to `$REPO_DIR`.
`npm ci` and `npm run build` ran in it, and Chromium, Firefox and WebKit are installed. It is
tip-of-tree for this repo: reproduce there, as a test in its `tests/mcp/`. Read its `AGENTS.md` in
full before you write that test. It says how to build, test and lint it, and which fixtures the MCP
tests use. The clone has the full history, without file contents until git needs them, so `git log`
and `git tag --contains` work there.

The pinned version is older than tip-of-tree. `npm view playwright-core@<alpha> gitHead` prints the
upstream commit that an alpha was built from.

## Fix in microsoft/playwright

When the fix is in `$PLAYWRIGHT_DIR`, follow the Fix section of the guide there, in place of
`$REPO_DIR`: create the branch `fix-<n>` from `main` in `$PLAYWRIGHT_DIR`, put the regression test in its
`tests/mcp/`, build and lint as its `AGENTS.md` says, and commit in its convention, for example
`fix(mcp): ...`. Then leave the proposal in `$OUTPUT_DIR/upstream-fix/` in place of
`$OUTPUT_DIR/fix/`, with the same files:

- `fix.patch`: the output of `git diff --binary main HEAD` in `$PLAYWRIGHT_DIR`.
- `pr-body.md`: as the guide says. The `Fixes` line has the full URL of the issue,
  `Fixes https://github.com/microsoft/playwright-mcp/issues/<n>`, so that the PR closes the issue in
  this repo.
- `proposal.json`: as the guide says. Write it last.

The publish job opens the draft PR in `microsoft/playwright`. The revision workflow of that repo
addresses the review. Leave one proposal: `fix/` or `upstream-fix/`, not both. Do not change
`package.json` here to pick up the fix. It reaches `@playwright/mcp` with the next roll.

**Check the linked PRs in both repos.** A PR in `microsoft/playwright` links this issue with its
full URL or as `microsoft/playwright-mcp#<n>`. Search there too:
`repo:microsoft/playwright is:pr "playwright-mcp/issues/<n>"` and
`repo:microsoft/playwright is:pr "playwright-mcp#<n>"`. A PR there from the team or from
`microsoft-playwright-automation` is a team PR. Verify a PR there in `$PLAYWRIGHT_DIR`.

**Already fixed** means that tip-of-tree passes and the pinned version fails. The fix reaches users
with the next roll. Find the upstream PR with
`git -C $PLAYWRIGHT_DIR log <gitHead of the pinned alpha>..main -- packages/playwright-core/src/tools`,
and name it in the note.

## Published versions

To run a published version, for example the version of the reporter or to bisect, create
`$SCRATCH_DIR/playwright-mcp-<n>/<version>/` and run there:

```bash
npm init -y
npm i @playwright/mcp@<version> @modelcontextprotocol/sdk
npx playwright install chromium firefox webkit
```

The fixtures of the repo are not available there. Write the condensed repro as a plain script in
that directory. It starts `node_modules/@playwright/mcp/cli.js --headless` with the
`StdioClientTransport` of the SDK, as `createTransport()` in `tests/fixtures.ts` does, and calls the
tools with `client.callTool()`. Serve the page from a `data:` URL or from `http.createServer()` in
the script.

`npm view @playwright/mcp@<version> dependencies.playwright-core` prints the alpha of a release.
Match a regression to upstream commits with
`git -C $PLAYWRIGHT_DIR log <good gitHead>..<bad gitHead> -- packages/playwright-core/src/tools`.

## PRs from third parties

Do not run a PR in this repo that changes `package.json`, `package-lock.json`, `roll.js`,
`update-readme.js`, `utils/`, `Dockerfile`, `.devcontainer/`, `.github/`, `.azure-pipelines/` or
`.claude/`. For a PR in `microsoft/playwright`, the list in
`$PLAYWRIGHT_DIR/.claude/skills/playwright-triage/SKILL.md` applies.
