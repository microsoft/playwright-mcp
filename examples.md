# Examples

Below are some examples of prompts to use with Playwright MCP. Draw inspiration from them to create your own. If you come up with a new prompt that works well, feel free to let us know in an issue or pull request.

## Write a regression test for a bug report

We have received a user report about a bug on our website https://debs-obrien.github.io/playwright-movies-app. I'd like you to verify if this bug exists by trying to follow the steps. If you see different behaviour, explain how it's different. If you see the same behaviour, please write me a Playwright regression test that encapsulates the buggy user flow. While writing the test, draw inspiration from the Playwright code you ran. Here's the user report:

Howdy. I love your movies site, but there's something fishy going on. I'm looking at The Garfield Movie - a spectacular film - but somehow it's showing the wrong length. The movie is 90mins long, I measured myself yesterday! But somehow your site is claiming 101mins. Am I looking at it wrong, or is there a bug?

**Output:**

```ts
import { test, expect } from '@playwright/test';

/**
 * Regression test for bug: The Garfield Movie showing incorrect runtime
 * User reported actual runtime is 90 minutes, but site shows 101 minutes
 */
test('verify The Garfield Movie runtime bug', async ({ page }) => {
  // Navigate to the movies app home page
  await page.goto('https://debs-obrien.github.io/playwright-movies-app');
  
  // Wait for page to load completely
  await expect(page.getByRole('heading', { name: 'Popular', level: 1 })).toBeVisible();
  
  // Look for The Garfield Movie and click on it
  const garfieldMovieLink = page.getByRole('link', { name: /poster of The Garfield Movie/i });
  await expect(garfieldMovieLink).toBeVisible();
  await garfieldMovieLink.click();
  
  // Verify we're on the correct movie page
  await expect(page.getByRole('heading', { name: 'The Garfield Movie', level: 1 })).toBeVisible();
  
  // Check the runtime information
  // The bug: Expected runtime should be 90 min, but site shows 101 min
  const movieInfoText = await page.locator('text=English / 101 min. / 2024').textContent();
  
  // This test will fail because of the bug (which is what we want to demonstrate)
  // Once fixed, this assertion should be updated to the correct runtime (90 min)
  expect(movieInfoText).toContain('90 min');
  
  // Alternative assertion that verifies the incorrect runtime is still present
  // Uncomment this and comment the above assertion to verify the bug exists
  // expect(movieInfoText).toContain('101 min');
});
```
