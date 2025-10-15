# Contributing

## Choose an issue

Playwright MCP **requires an issue** for every contribution, except for minor documentation updates.

If you are passionate about a bug/feature, but cannot find an issue describing it, **file an issue first**. This will
facilitate the discussion, and you might get some early feedback from project maintainers before spending your time on
creating a pull request.

## Make a change

> [!WARNING]
> The core of the Playwright MCP was moved to the [Playwright monorepo](https://github.com/microsoft/playwright).

Clone the Playwright repository. If you plan to send a pull request, it might be better to [fork the repository](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/working-with-forks/fork-a-repo) first.


```bash
git clone https://github.com/microsoft/playwright
cd playwright
```

Install dependencies and run the build in watch mode.
```bash
# install deps and run watch
npm ci
npm run watch
npx playwright install
```

Source code for Playwright MCP is located at [packages/playwright/src/mcp](https://github.com/microsoft/playwright/blob/main/packages/playwright/src/mcp).

```bash
# list source files
ls -la packages/playwright/src/mcp
```

Coding style is fully defined in [eslint.config.mjs](https://github.com/microsoft/playwright/blob/main/eslint.config.mjs). Before creating a pull request, or at any moment during development, run linter to check all kinds of things:
```bash
# lint the source base before sending PR
npm run flint
```

Comments should have an explicit purpose and should improve readability rather than hinder it. If the code would not be understood without comments, consider re-writing the code to make it self-explanatory.

## Add a test

Playwright requires a test for the new or modified functionality. An exception would be a pure refactoring, but chances are you are doing more than that.

There are multiple [test suites](https://github.com/microsoft/playwright/blob/main/tests) in Playwright that will be executed on the CI. Tests for Playwright MCP are located at [tests/mcp](https://github.com/microsoft/playwright/blob/main/tests/mcp).

```bash
# list test files
ls -la tests/mcp
```

To run the mcp tests, use

```bash
# fast path runs all MCP tests in Chromium
npm run mcp-ctest
```

```bash
# slow path runs all tests in three browsers
npm run mcp-test
```

Since Playwright tests are using Playwright under the hood, everything from our documentation applies, for example [this guide on running and debugging tests](https://playwright.dev/docs/running-tests#running-tests).

Note that tests should be *hermetic*, and not depend on external services. Tests should work on all three platforms: macOS, Linux and Windows.

## Write a commit message

Commit messages should follow the [Semantic Commit Messages](https://www.conventionalcommits.org/en/v1.0.0/) format:

```
label(namespace): title

description

footer
```

1. *label* is one of the following:
    - `fix` - bug fixes
    - `feat` - new features
    - `docs` - documentation-only changes
    - `test` - test-only changes
    - `devops` - changes to the CI or build
    - `chore` - everything that doesn't fall under previous categories
2. *namespace* is put in parentheses after label and is optional. Must be lowercase.
3. *title* is a brief summary of changes.
4. *description* is **optional**, new-line separated from title and is in present tense.
5. *footer* is **optional**, new-line separated from *description* and contains "fixes" / "references" attribution to GitHub issues.

Example:

```
feat(trace viewer): network panel filtering

This patch adds a filtering toolbar to the network panel.
<link to a screenshot>

Fixes #123, references #234.
```

## Send a pull request

All submissions, including submissions by project members, require review. We use GitHub pull requests for this purpose.
Make sure to keep your PR (diff) small and readable. If necessary, split your contribution into multiple PRs.
Consult [GitHub Help](https://help.github.com/articles/about-pull-requests/) for more information on using pull requests.

After a successful code review, one of the maintainers will merge your pull request. Congratulations!

## More details

**No new dependencies**

There is a very high bar for new dependencies, including updating to a new version of an existing dependency. We recommend to explicitly discuss this in an issue and get a green light from a maintainer, before creating a pull request that updates dependencies.

## Contributor License Agreement

This project welcomes contributions and suggestions.  Most contributions require you to agree to a
Contributor License Agreement (CLA) declaring that you have the right to, and actually do, grant us
the rights to use your contribution. For details, visit https://cla.opensource.microsoft.com.

When you submit a pull request, a CLA bot will automatically determine whether you need to provide
a CLA and decorate the PR appropriately (e.g., status check, comment). Simply follow the instructions
provided by the bot. You will only need to do this once across all repos using our CLA.

### Code of Conduct

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/).
For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or
contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.
