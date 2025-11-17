# Repository Privacy and Security Guide

## Overview

This guide provides comprehensive instructions for securing this Playwright MCP repository by changing its visibility settings and implementing security best practices.

## Immediate Action Required: Make Repository Private

### Why This Matters

This repository contains browser automation tooling that could pose security risks if publicly accessible:
- **MCP Server Configuration**: Could expose internal infrastructure patterns
- **Browser Automation Capabilities**: Potential misuse for unauthorized automation
- **Integration Patterns**: May reveal organizational security practices
- **Dependencies and Versions**: Could be targeted for known vulnerabilities

### How to Make This Repository Private

#### Option 1: Via GitHub Web Interface (Recommended)

1. Navigate to your repository on GitHub: `https://github.com/GPTI314/playwright-mcp`
2. Click on **Settings** (gear icon in the top menu)
3. Scroll down to the **Danger Zone** section at the bottom
4. Click **Change visibility**
5. Select **Make private** or **Make internal** (if available for your organization)
   - **Private**: Only you and collaborators you explicitly grant access can view
   - **Internal**: Only members of your organization can view (GitHub Enterprise only)
6. Type the repository name to confirm
7. Click **I understand, change repository visibility**

#### Option 2: Via GitHub CLI (if installed)

```bash
gh repo edit GPTI314/playwright-mcp --visibility private
```

Or for internal visibility (GitHub Enterprise):

```bash
gh repo edit GPTI314/playwright-mcp --visibility internal
```

#### Option 3: Via GitHub API

```bash
curl -X PATCH \
  -H "Accept: application/vnd.github+json" \
  -H "Authorization: Bearer YOUR_GITHUB_TOKEN" \
  https://api.github.com/repos/GPTI314/playwright-mcp \
  -d '{"private":true}'
```

## Security Best Practices

### 1. Review Commit History for Sensitive Data

Before making the repository private, audit your commit history for accidentally committed secrets:

```bash
# Check for potential secrets in commit history
git log -p | grep -i "password\|secret\|api_key\|token"

# Use git-secrets or similar tools
git secrets --scan-history
```

If sensitive data is found, consider:
- Using `git filter-repo` or `BFG Repo-Cleaner` to remove it
- Rotating all exposed credentials immediately
- Force-pushing the cleaned history (⚠️ coordination required with all collaborators)

### 2. Environment Variables and Secrets

**Never commit:**
- API keys or tokens
- Passwords or credentials
- SSH private keys
- OAuth secrets
- Database connection strings
- Cloud provider credentials

**Instead:**
- Use environment variables (`.env` files - already in `.gitignore`)
- Use secrets management services (Azure Key Vault, AWS Secrets Manager, HashiCorp Vault)
- For GitHub Actions, use [encrypted secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)

### 3. Access Control

**Implement least privilege:**
- Only grant repository access to users who need it
- Use teams for group permissions
- Regularly audit collaborators
- Remove access for former team members immediately

### 4. Branch Protection

**Enable branch protection rules:**

1. Go to Settings → Branches
2. Add rule for your main branch
3. Enable:
   - Require pull request reviews
   - Require status checks to pass
   - Require signed commits
   - Include administrators
   - Restrict who can push

### 5. Dependency Security

**Monitor and update dependencies:**

```bash
# Check for vulnerabilities
npm audit

# Fix vulnerabilities
npm audit fix

# For more advanced scanning
npm audit --audit-level=moderate
```

**Enable GitHub security features:**
- Dependabot alerts
- Dependabot security updates
- Code scanning (GitHub Advanced Security)
- Secret scanning

### 6. MCP Server Specific Security

**When deploying this MCP server:**

1. **Restrict allowed hosts** using `--allowed-hosts` parameter
2. **Use authentication** for SSE transport endpoints
3. **Enable sandboxing** (avoid `--no-sandbox` in production)
4. **Limit capabilities** using `--caps` only for required features
5. **Isolate browser contexts** with `--isolated` flag
6. **Monitor output directory** if using `--output-dir`
7. **Secure secrets** if using `--secrets` parameter

Example secure configuration:

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": [
        "@playwright/mcp@latest",
        "--isolated",
        "--allowed-hosts", "trusted-domain.com",
        "--block-service-workers",
        "--ignore-https-errors", "false",
        "--headless"
      ]
    }
  }
}
```

### 7. Network Security

**Implement network controls:**
- Use `--allowed-hosts` to whitelist permitted domains
- Use `--proxy-server` for controlled internet access
- Monitor network requests with `browser_network_requests` tool
- Block service workers if not needed: `--block-service-workers`

### 8. Audit Logging

**Enable comprehensive logging:**
- Use `--save-trace` for debugging (not in production)
- Use `--save-session` for incident investigation
- Monitor console messages for anomalies
- Review browser network requests regularly

## Post-Privacy Change Checklist

After making the repository private, verify:

- [ ] Repository is no longer visible in public search
- [ ] All team members who need access have been explicitly granted it
- [ ] Branch protection rules are enabled
- [ ] Dependabot alerts are enabled
- [ ] Secret scanning is enabled (if available)
- [ ] Code scanning is configured (if available)
- [ ] CI/CD secrets are stored securely in GitHub Actions secrets
- [ ] Documentation references to public URLs are updated
- [ ] External integrations (webhooks, apps) are still functioning

## Incident Response

If you suspect security compromise:

1. **Immediate Actions:**
   - Change repository to private immediately
   - Rotate all credentials that may have been exposed
   - Review access logs for unauthorized activity
   - Disable compromised user accounts

2. **Investigation:**
   - Review commit history for malicious changes
   - Audit collaborator access and recent activities
   - Check deployed instances for compromise
   - Analyze logs for suspicious patterns

3. **Reporting:**
   - Follow the `SECURITY.md` guidelines for reporting to Microsoft
   - Report to your security team
   - Document the incident timeline

## Compliance Considerations

Depending on your use case, consider:

- **GDPR**: If processing EU user data
- **HIPAA**: If handling healthcare information
- **SOC 2**: For service organizations
- **PCI DSS**: If processing payment card data

## Additional Resources

- [GitHub Security Best Practices](https://docs.github.com/en/code-security)
- [Playwright Security Considerations](https://playwright.dev/docs/library#browser-contexts)
- [MCP Security Guidelines](https://modelcontextprotocol.io/)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)

## Support

For security concerns specific to this codebase, refer to `SECURITY.md`.

For general security questions, contact your security team.

---

**Document Version**: 1.0
**Last Updated**: 2025-11-17
**Maintained By**: Repository Security Team
