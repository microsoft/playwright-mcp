# Dependency Management Policy

This document outlines our approach to managing dependencies in the playwright-mcp project.

## Dependency Update Process

1. **Regular Audits**: Dependencies are audited upon supported version changes using `npm audit` to identify any security vulnerabilities.
2. **Update Schedule**: Security updates will be applied immediately, other updates are upon request.
3. **Version Pinning**: All dependencies are pinned to specific versions to ensure reproducible builds.
5. **Monitoring**: We use GitHub's dependabot alerts to monitor for security vulnerabilities in our dependencies.

## Reporting Issues

If you discover a security vulnerability in one of our dependencies, please follow the security reporting guidelines in our [SECURITY.md](./SECURITY.md) file.
