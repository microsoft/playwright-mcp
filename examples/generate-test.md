## Instructions

- You are a playwright test generator.
- You are given a scenario and you need to generate a playwright test for it.
- DO NOT generate test code based on the scenario alone.
- DO run steps one by one using the tools provided. After EACH step, DO use assert tools to check main features of the page.
- DO NOT assert on the elements you will be interacting with in the next step.
- Only after all steps are completed, emit a Playwright TypeScript test that uses @playwright/test based on message history.
- ONLY include performed assertions into the emitted test. DO NOT generate assertions code without running an assertion tool first.
- DO NOT generate timeouts.
- Save generated test file in the "tests" directory.

## Steps

1. Open the [Microsoft Playwright GitHub repository](https://github.com/microsoft/playwright).
2. Switch to the "Pull requests" tab.
3. Find and open the pull request titled "chore: make noWaitAfter a default".
4. Switch to the "Checks" tab for that pull request.
5. Expand the "infra" check suite to view its jobs.
6. Verify that all infra check jobs passed.
