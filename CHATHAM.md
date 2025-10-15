# Chatham Organization - MCP Security Review and Approval

This document outlines the security review and approval status for the `playwright-mcp` repository for use within the Chatham organization.

## Review Details

*   **Repository:** `Chatham/playwright-mcp`
*   **Commit SHA at Review:** 34f1ec9cea98b44ddc29fe2921c7907b91b8271d
*   **Latest Review Date:** October 15, 2025
*   **Reviewers/Approvers:**
    *   Reviewer: Ashley Bloxom
    *   Approver: Paul Hiatt

### Security Checks

| Check                                                                 | Status   | Notes |
| :-------------------------------------------------------------------- | :------- | :---- |
| **SECURITY.md File**                                                  |         |       |
|   - Existence of `SECURITY.md`                                        | [x] Done | Present and follows MSRC template |
|   - `SECURITY.md` contains clear vulnerability reporting instructions | [x] Done | MSRC links and PGP details provided |
|   - `SECURITY.md` outlines supported versions & update policy         | [x] Done | Present; consider updating supported version table to reflect 0.0.42 |
| **Dependency Management**                                             |         |       |
|   - No known critical vulnerabilities in direct dependencies          | [x] Done | `npm audit --omit=dev` shows 0 vulns at root and in `extension/` |
|   - Dependencies are pinned to specific versions                      | [x] Done | Runtime deps pinned; some devDeps in extension use caret ranges (acceptable) |
|   - Plan for monitoring and updating dependencies                     | [x] Done | `DEPENDENCIES.md` present; versions updated to Playwright 1.57.0-alpha |
| **Code Review**                                                       |         |       |
|   - Sensitive data handling (no hardcoded secrets, PII, etc.)         | [x] Done | No secrets found; extension token stored in `localStorage` only |
|   - Input validation and sanitization                                 | [x] Done | Zod schemas for tool inputs; file path sanitization in `sanitizeForFilePath` |
|   - Secure use of external commands/processes                         | [x] Done | Controlled fork of Playwright CLI for install; no user-controlled shell exec |
|   - Error handling and logging (no sensitive info in logs)            | [x] Done | Errors generic; debug logging gated via `debug`/console in extension |
| **Build & Release Process**                                           |         |       |
|   - Build process is reproducible                                     | [x] Done | TypeScript + Vite builds; Dockerfile produces minimal runtime image |
|   - Release artifacts are securely stored                             | [x] N/A  | Typically consumed from source/npm |
| **Documentation**                                                     |         |       |
|   - Clear installation and usage instructions                         | [x] Done | README documents usage; extension README referenced |
|   - Documentation on security features or considerations              | [x] Done | `SECURITY-FEATURES.md` kept up to date |
| **Threat Modeling**                                                   |         |       |
|   - Potential threats and attack vectors identified                   | [x] Done | Origin allow/block lists; UI consent/token for extension bridging |
|   - Mitigations for identified threats in place                       | [x] Done | Network interception enforces allow/deny lists; token-based bypass with CSPRNG |
| **Licensing**                                                         |         |       |
|   - `LICENSE` file exists                                             | [x] Done | Apache 2.0 |
|   - License is compatible with organizational policies                | [x] Done | Apache 2.0 |


## Installation and Usage of Approved Version

To ensure you are using the reviewed and approved version of this tool, follow these installation steps:

1.  **Clone the Repository:**
    ```bash
    git clone [repository_url] playwright-mcp
    cd playwright-mcp
    ```
    *(Replace `[repository_url]` with the actual URL to the repository if it's hosted, or ensure you have the correct local copy.)*

2.  **Checkout the Approved Commit:**
    ```bash
    git checkout 0df6d7a441c8fedfe449c115f371e4edd411a865
    ```

3.  **Install Dependencies:**
    ```bash
    npm install
    ```

4.  **Build the Project:**
    ```bash
    npm run clean && npm run build
    ```

5.  **Configure in VS Code (or other MCP client):**
    When configuring this MCP server (e.g., in VS Code `mcp.json`), ensure you point to the local `cli.js` file within your cloned and built repository.

    Example VS Code `settings.json` configuration:
    ```json
    {
        // ... other settings ...
         "servers": {
             // ... other mcp servers ...
             "playwright": {
                 "command": "npx", // needs to be "node" on Windows machines
                 "args": [
                     "[path_to_your_cloned_repo]/playwright-mcp/cli.js"
                     // Add any other necessary arguments here, e.g., --port, --browser
                 ]
             }
         }
        // ... other settings ...
    }
    ```
    Replace `[path_to_your_cloned_repo]` with the absolute path to where you cloned the `playwright-mcp` repository. For example, if you cloned it into `/Users/yourname/projects/`, the path would be `/Users/yourname/projects/playwright-mcp/cli.js`.

 **Tips (last updated 10/14/2025):**
 1. To get to this file in VS Code, use the context menu command `> MCP: Open User Configuration`
 2. To get to this file in Cursor, use the context menu command `> View: Open MCP Settings`. Then click "New MCP Server". The top-level key is not `servers` in Cursor, but `mcpServers`.

## Notes and Considerations

*   The following security-related documents have been created:
    *   **DEPENDENCIES.md** - Documents the dependency management and update policy
    *   **SECURITY-FEATURES.md** - Documents the security features and best practices
*   The `SECURITY.md` file has been updated to include supported versions information.
*   No critical security issues were identified during this review.

---
*This document is subject to updates upon new reviews or significant changes to the repository.*
