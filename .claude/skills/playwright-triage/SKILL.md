---
name: playwright-triage
description: Triage and fix an issue in microsoft/playwright-mcp. Where the code of the MCP server is, how to reproduce on tip-of-tree in microsoft/playwright, where a fix goes, how to run a published version, and what not to run from a PR of a third party.
---

# Playwright MCP Issue Triage

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

## Reproduce on tip-of-tree

The pinned alpha is older than tip-of-tree. `npm view playwright-core@<alpha> gitHead` prints the
upstream commit that an alpha was built from.

Reproduce in a checkout of `microsoft/playwright` at the tip of `main`, next to this repo, in
`../playwright`, where `roll.js` reads it too. Write the repro as a test in its `tests/mcp/`. Read
its `AGENTS.md` in full before you write that test. It says how to build, test and lint it, and
which fixtures the MCP tests use.

The `chrome` and `msedge` projects of this repo use Google Chrome and Microsoft Edge. When one is
missing, install it with `npx playwright install chrome msedge`.

## Fix in microsoft/playwright

When the cause is upstream, fix it in `../playwright`: create the branch `fix-<n>` from `main`, put
the regression test in its `tests/mcp/`, build and lint as its `AGENTS.md` says, and commit in its
convention, for example `fix(mcp): ...`. The PR there says
`Refs https://github.com/microsoft/playwright-mcp/issues/<n>`: the issue stays open until this repo
rolls to the fix. Open one PR, here or in `microsoft/playwright`, not both. Do not change
`package.json` here in the same change.

After the upstream PR merges, the fix reaches this repo with a roll. Check that `playwright@next`
has it:
`git -C ../playwright merge-base --is-ancestor <fix commit> <gitHead of playwright-core@next>`. If
it has the fix, roll this repo to it, as "Rolling Playwright" in [AGENTS.md](../../../AGENTS.md)
says, and add a test here when the tests of this repo can cover the issue. That PR says
`Fixes <issue url>`. If it does not have the fix yet, the next alpha brings it.

**Check the linked PRs in both repos.** A PR in `microsoft/playwright` links this issue with its
full URL or as `microsoft/playwright-mcp#<n>`. Search there too:
`repo:microsoft/playwright is:pr "playwright-mcp/issues/<n>"` and
`repo:microsoft/playwright is:pr "playwright-mcp#<n>"`. A PR there from the team or from
`microsoft-playwright-automation` is a team PR. Verify a PR there in `../playwright`.

**Already fixed** means that tip-of-tree passes and the pinned version fails. The fix reaches users
with the next roll. Find the upstream PR with
`git -C ../playwright log <gitHead of the pinned alpha>..main -- packages/playwright-core/src/tools`,
and name it.

## Published versions

To run a published version, for example the version of the reporter or to bisect, create an empty
directory outside the repo for each version, and run there:

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
`git -C ../playwright log <good gitHead>..<bad gitHead> -- packages/playwright-core/src/tools`.

## PRs from third parties

Do not run a PR in this repo that changes `package.json`, `package-lock.json`, `roll.js`,
`update-readme.js`, `utils/`, `Dockerfile`, `.devcontainer/`, `.github/`, `.azure-pipelines/` or
`.claude/`. For a PR in `microsoft/playwright`, the list in
`../playwright/.claude/skills/playwright-triage/SKILL.md` applies.
