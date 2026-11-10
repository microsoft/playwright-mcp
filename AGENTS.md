## How this repo depends on Playwright

This repo ships the npm package `@playwright/mcp`. The MCP server itself is in
`microsoft/playwright`, in `packages/playwright-core/src/tools/`: `mcp/` has the server, its config
and its command line options, and `backend/` has the tools.

- **What this repo owns:** `cli.js` and `index.js`, which run the server of the pinned
  `playwright-core`, the types, the README, the Dockerfile, and the tests of the packaged server.
- **What is a copy or an output:** `roll.js` copies `config.d.ts` from
  `packages/playwright-core/src/tools/mcp/config.d.ts`, and `npm run lint` generates the tools and
  options in `README.md` from the tools. Change them upstream.
- **The pin:** `package.json` pins an alpha of `playwright` and `playwright-core`.
  `npm view playwright-core@<alpha> gitHead` prints the upstream commit of an alpha, and
  `npm view @playwright/mcp@<version> dependencies.playwright-core` prints the alpha of a release.
  The pin is older than the tip of upstream `main`.
- **Where a fix goes:** most bugs and features are upstream. Work in a checkout of
  `microsoft/playwright` next to this repo, `../playwright`, as its `AGENTS.md` says. The tests of
  the server are its `tests/mcp/`. Fix here only what this repo owns.
- **How a fix arrives:** with a roll, after `playwright@next` has the upstream commit. The upstream
  PR says `Refs <issue url>` for an issue of this repo, and the roll PR here says `Fixes`.

## Build and test

```bash
npm ci
npx playwright install --with-deps
npm run lint                                   # regenerates README.md; CI fails when it changes a file
npm test                                       # every project: chrome, msedge, chromium, firefox, webkit
npm run ctest                                  # chrome only
npx playwright test tests/core.spec.ts --project=chromium
```

There is no build step. Tests are in `tests/*.spec.ts`, with `test` and `expect` from
`./fixtures`. The `client` fixture is an MCP client that runs `cli.js` over stdio, `startClient()`
starts one with `args` or a `config`, and `server` and `httpsServer` serve the pages. Call a tool
with `client.callTool({ name, arguments })` and check the result with `toHaveResponse()`. Add a case
to the test whose setup is closest instead of a new test, and run the file on every project.

## Commit Convention

Semantic commit messages: `label(scope): description`

Labels: `fix`, `feat`, `chore`, `docs`, `test`, `devops`

```bash
git checkout -b fix-39562
# ... make changes ...
git add <changed-files>
git commit -m "$(cat <<'EOF'
fix(proxy): handle SOCKS proxy authentication

Fixes: https://github.com/microsoft/playwright/issues/39562
EOF
)"
git push origin fix-39562
gh pr create --repo microsoft/playwright --head username:fix-39562 \
  --title "fix(proxy): handle SOCKS proxy authentication" \
  --body "$(cat <<'EOF'
## Summary
- <describe the change very! briefly>

Fixes https://github.com/microsoft/playwright/issues/39562
EOF
)"
```

Never add Co-Authored-By agents in commit message.
Branch naming for issue fixes: `fix-<issue-number>`

## Rolling Playwright

1. Run `node roll.js` (or `npm run roll`) to bump `playwright`, `playwright-core`, and `@playwright/test`, refresh `config.d.ts`, and regenerate the README. The script prints the resolved version — use its suffix for the branch name. It copies `config.d.ts` from `../playwright`, a checkout of `microsoft/playwright`: check out the commit that the new version was built from (`npm view playwright-core@<version> gitHead`) first.
2. Create a branch: `git checkout -b roll-pw-<version-suffix>`.
3. Run `npm test`. Only proceed if all tests pass.
4. Commit with `chore: roll Playwright to <version>`, push, and open a PR against `microsoft/playwright-mcp` with the same title.

## Preparing a Release

See [.claude/skills/release.md](.claude/skills/release.md).

## Bots

The Playwright bot does the work below. It opens pull requests as the
`microsoft-playwright-automation` app. [triage.yml](.github/workflows/triage.yml) and
[review.yml](.github/workflows/review.yml) hand it the labels:

- `agent-triage` on an issue: finds the cause and fixes the issue if it can. A fix in `microsoft/playwright` opens as a draft PR there.
- `agent-implement` on an issue: implements what the issue and the maintainers' comments say.
- `agent-task` on an issue: does what the issue asks, with the skills of this repo.
- `agent-review` on a PR: revises the PR, as the maintainers' review comments say.
- [roll.yml](.github/workflows/roll.yml) and [release.yml](.github/workflows/release.yml), from the Actions tab: they hand a task to the bot. Roll Playwright to `playwright@next`, as "Rolling Playwright" says. Or open the `chore: mark v<version>` PR with the release notes as its description, as the release skill says. Copy the notes into the release draft.
- [task.yml](.github/workflows/task.yml), from the Actions tab: hands the bot the task that you type, with the skills of this repo.

Apply a label again to start another run.
