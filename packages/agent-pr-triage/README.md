# PR Triage Patch Agent

This package implements a specialist agent dedicated to triaging and patching GitHub Issues and Pull Requests. It focuses on minimal, high-confidence changes to resolve specific problems.

## Specification
- **Version**: 1.0
- **Status**: Implementation Phase
- **Target Repo**: `anthropicsclaude-code-action`

## Key Responsibilities
1. **Classification**: Identify the nature of the task.
2. **Scope Assessment**: Determine affected files and modules.
3. **Patch Generation**: Create focused git patches.
4. **Verification**: Coordinate with Browser Agent to verify PR status.

## Implementation Details
Refer to `AGENT-1_-PR-Triage-Patch-Agent.md` in the root for the full system prompt and logic.
