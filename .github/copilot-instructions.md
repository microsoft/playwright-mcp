# Project Guidelines

## Scope
- This file is the single workspace instruction source for this repo.
- Keep instructions minimal and project-wide; avoid duplicating details already covered in docs.

## Architecture
- Monorepo structure:
  - `packages/playwright-mcp`: published MCP package (`@playwright/mcp`) and MCP tests.
  - `packages/extension`: browser extension implementation and extension tests.
  - `packages/playwright-cli-stub`: compatibility stub package.
- Important boundary: MCP core implementation was moved to the Playwright monorepo. For core MCP behavior changes, use upstream source in Playwright (`packages/playwright/src/mcp`) and not this repository.

## Build And Test
- Use Node.js 18+ locally (CI runs Node.js 20).
- Install dependencies from repo root: `npm ci`.
- Root workspace commands:
  - `npm run build`
  - `npm run lint`
  - `npm run test`
- Package-level commands when iterating:
  - MCP package: `npm run test --workspace=packages/playwright-mcp`
  - Extension package: `npm run test --workspace=packages/extension`
- Before tests, install browsers when needed: `npx playwright install --with-deps`.
- Note: extension tests run only on macOS in CI; keep changes portable across macOS/Linux/Windows.

## Conventions
- Follow semantic commits: `label(scope): description`.
  - Allowed labels: `fix`, `feat`, `chore`, `docs`, `test`, `devops`.
- For issue fixes, use branch format: `fix-<issue-number>`.
- Do not add `Co-Authored-By` agent trailers in commit messages.
- Tests should be hermetic and must not depend on external services.
- Treat dependency changes conservatively. New dependencies or dependency updates require prior maintainer discussion.

## Project-Specific Pitfalls
- `packages/playwright-mcp` lint step runs `node update-readme.js`; keep generated README content in sync when changing relevant config/docs.
- Docker MCP tests depend on `MCP_IN_DOCKER=1` and chromium-docker project setup.

## Source Of Truth
- Contribution process and policy: [CONTRIBUTING.md](../CONTRIBUTING.md)
- Commit convention reference used in this repo: [CLAUDE.md](../CLAUDE.md)
- Product overview and client setup: [README.md](../README.md)
- Extension setup and usage: [packages/extension/README.md](../packages/extension/README.md)
