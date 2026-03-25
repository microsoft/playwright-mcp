# Contributing

## Principles
- All changes must go through pull requests
- No direct pushes to `main`
- All CI checks must pass before merge

## Required checks
- install/build must succeed
- typecheck must pass
- lint must pass
- tests must pass (if present)

## MCP Tool Rules
- Do not expose tools that are not implemented
- All tools must:
  - validate inputs
  - fail loudly with explicit errors
  - never silently return partial results

## Security
- Never commit secrets
- Do not broaden permissions without justification
- Any change to CI/CD must be reviewed

## Extension Rules
- Minimize permissions
- Avoid `<all_urls>` unless strictly required
- Validate all external connections (WebSocket / HTTP)

## Branching
- feature/* for features
- fix/* for bug fixes
- chore/* for maintenance
- audit/* for audits and hardening
