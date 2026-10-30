## Build and test

The MCP server source lives in `microsoft/playwright`, in `packages/playwright-core/src/tools/`.
This repo ships `@playwright/mcp`: `cli.js` and `index.js` run the server from the `playwright-core`
alpha that `package.json` pins. `config.d.ts` is a copy of the upstream file, and `npm run lint`
generates the tool list in `README.md`.

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

Labels start GitHub Actions workflows that run the Copilot CLI and open pull requests as the
`microsoft-playwright-automation` app:

- `needs-triage`, `needs-triage-mac`, `needs-triage-win` on an issue: [triage.yml](.github/workflows/triage.yml) reproduces and fixes it, with the skill in [.claude/skills/playwright-triage/](.claude/skills/playwright-triage/SKILL.md). A fix in `microsoft/playwright` opens as a draft PR there.
- `needs-revision`, `needs-revision-mac`, `needs-revision-win` on a PR that triage opened here: [revision.yml](.github/workflows/revision.yml) addresses the maintainers' review comments.
- `needs-roll` on an issue: [roll.yml](.github/workflows/roll.yml) rolls Playwright to `playwright@next`, as "Rolling Playwright" says.
- `needs-release` on an issue: [release.yml](.github/workflows/release.yml) opens the `chore: mark v<version>` PR with the release notes as its description, as the release skill says. Copy the notes into the release draft.

Apply a label again to start another run. [bots.md](https://github.com/microsoft/playwright/blob/main/.github/workflows/bots.md) in `microsoft/playwright` describes triage and revision.
