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

1. Run `node roll.js` (or `npm run roll`) to bump `playwright`, `playwright-core`, and `@playwright/test`, refresh `config.d.ts`, and regenerate the README. The script prints the resolved version — use its suffix for the branch name.
2. Create a branch: `git checkout -b roll-pw-<version-suffix>`.
3. Run `npm test`. Only proceed if all tests pass.
4. Commit with `chore: roll Playwright to <version>`, push, and open a PR against `microsoft/playwright-mcp` with the same title.

## Preparing a Release

See [.claude/skills/release.md](.claude/skills/release.md).
