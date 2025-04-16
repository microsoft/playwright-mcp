# Write a regression test for a bug report

## Prompt:

We have received a user report about a bug on our website https://debs-obrien.github.io/playwright-movies-app. I'd like you to verify if this bug exists by trying to follow the steps. If you see different behaviour, explain how it's different. If you see the same behaviour, please write me a Playwright regression test that encapsulates the buggy user flow. Here's the user report:

Howdy. I love your movies site, but there's something fishy going on. I'm looking at The Garfield Movie - a spectacular film - but somehow it's showing the wrong length. The movie is 90mins long, I measured myself yesterday! But somehow your site is claiming 101mins. Am I looking at it wrong, or is there a bug?

## Output:

```ts
import { test, expect } from '@playwright/test';

test.describe('Movie Runtime Bug Verification', () => {
  test('The Garfield Movie shows incorrect runtime', async ({ page }) => {
    // Navigate to the movies app
    await page.goto('https://debs-obrien.github.io/playwright-movies-app');
    
    // Wait for the page to load completely
    await expect(page.getByRole('heading', { name: 'Popular', level: 1 })).toBeVisible();
    
    // Find and click on The Garfield Movie link
    const garfieldMovie = page.getByRole('heading', { name: 'The Garfield Movie', level: 2 }).first();
    
    // Ensure the movie is visible before clicking (might require scrolling)
    await garfieldMovie.scrollIntoViewIfNeeded();
    await expect(garfieldMovie).toBeVisible();
    
    // Click on the movie title to navigate to its details page
    await garfieldMovie.click();
    
    // Verify we're on the correct movie page
    await expect(page.getByRole('heading', { name: 'The Garfield Movie', level: 1 })).toBeVisible();
    
    // Get the movie details text that contains the runtime information
    const movieDetails = await page.locator('text=/English / \\d+ min\\. / \\d{4}/').textContent();
    
    // Extract the runtime from the details text
    const runtimeMatch = movieDetails.match(/English \/ (\d+) min\./);
    const actualRuntime = runtimeMatch ? parseInt(runtimeMatch[1], 10) : null;
    
    // Verify the runtime is incorrectly shown as 101 minutes (the bug)
    expect(actualRuntime).toBe(101);
    
    // This assertion would pass if the bug is fixed (runtime is corrected to 90 minutes)
    // Commented out for now but can be used once the bug is fixed
    // expect(actualRuntime).toBe(90);
  });
});
```
