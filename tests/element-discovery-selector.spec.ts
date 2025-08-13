import { expect, test } from '@playwright/test';
import type * as playwright from 'playwright';
import { ElementDiscovery } from '../src/diagnostics/element-discovery.js';

test.describe('ElementDiscovery generateSelector improvements', () => {
  let testPage: playwright.Page;
  let elementDiscovery: ElementDiscovery;

  test.beforeEach(async ({ page }) => {
    testPage = page;
    elementDiscovery = new ElementDiscovery(page);
  });

  test.afterEach(async () => {
    await elementDiscovery.dispose();
  });

  test('should generate unique selector with ID', async () => {
    // Setup HTML with element having ID
    await testPage.setContent(`
      <html>
        <body>
          <div id="unique-element">Target</div>
          <div class="form-control">Other</div>
        </body>
      </html>
    `);

    const element = await testPage.$('#unique-element');
    expect(element).not.toBeNull();

    const selector = await (elementDiscovery as any).generateSelector(element);

    // Should prioritize ID
    expect(selector).toBe('div#unique-element');

    // Verify selector uniqueness - should match only one element
    const matchedElements = await testPage.$$(selector);
    expect(matchedElements).toHaveLength(1);
  });

  test('should generate unique selector without ID using more specific attributes', async () => {
    // Setup HTML with multiple elements having same class
    await testPage.setContent(`
      <html>
        <body>
          <form>
            <input type="text" class="form-control" name="username" placeholder="Enter username">
            <input type="email" class="form-control" name="email" placeholder="Enter email">
            <input type="password" class="form-control" name="password">
          </form>
        </body>
      </html>
    `);

    const usernameInput = await testPage.$('input[name="username"]');
    expect(usernameInput).not.toBeNull();

    const selector = await (elementDiscovery as any).generateSelector(
      usernameInput
    );

    // Should not be ambiguous like 'input.form-control'
    expect(selector).not.toBe('input.form-control');

    // Should be more specific with attribute selector
    expect(selector).toMatch(/name="username"/);

    // Verify selector uniqueness - should match only one element
    const matchedElements = await testPage.$$(selector);
    expect(matchedElements).toHaveLength(1);
  });

  test('should use nth-of-type for identical sibling elements', async () => {
    // Setup HTML with identical sibling elements
    await testPage.setContent(`
      <html>
        <body>
          <div class="item">First</div>
          <div class="item">Second</div>
          <div class="item">Third</div>
        </body>
      </html>
    `);

    const secondItem = await testPage.$('div.item:nth-of-type(2)');
    expect(secondItem).not.toBeNull();

    const selector = await (elementDiscovery as any).generateSelector(
      secondItem
    );

    // Should include nth-of-type to make it unique
    expect(selector).toMatch(/:nth-of-type\(2\)|:nth-child\(2\)/);

    // Verify selector uniqueness - should match only one element
    const matchedElements = await testPage.$$(selector);
    expect(matchedElements).toHaveLength(1);
  });

  test('should generate selector with data attributes for uniqueness', async () => {
    // Setup HTML with data attributes
    await testPage.setContent(`
      <html>
        <body>
          <button class="btn" data-testid="submit-btn">Submit</button>
          <button class="btn" data-testid="cancel-btn">Cancel</button>
          <button class="btn">Reset</button>
        </body>
      </html>
    `);

    const submitBtn = await testPage.$('[data-testid="submit-btn"]');
    expect(submitBtn).not.toBeNull();

    const selector = await (elementDiscovery as any).generateSelector(
      submitBtn
    );

    // Should include data-testid for uniqueness
    expect(selector).toMatch(/data-testid="submit-btn"/);

    // Verify selector uniqueness - should match only one element
    const matchedElements = await testPage.$$(selector);
    expect(matchedElements).toHaveLength(1);
  });

  test('should handle nested elements with proper path', async () => {
    // Setup HTML with nested structure
    await testPage.setContent(`
      <html>
        <body>
          <div class="container">
            <div class="row">
              <div class="col">
                <input type="text" class="form-control">
              </div>
            </div>
          </div>
          <div class="sidebar">
            <input type="text" class="form-control">
          </div>
        </body>
      </html>
    `);

    const containerInput = await testPage.$('.container .form-control');
    expect(containerInput).not.toBeNull();

    const selector = await (elementDiscovery as any).generateSelector(
      containerInput
    );

    // Should include parent context for uniqueness
    expect(selector).toMatch(/container.*form-control|\.col.*input/);

    // Verify selector uniqueness - should match only one element
    const matchedElements = await testPage.$$(selector);
    expect(matchedElements).toHaveLength(1);
  });

  test('should generate stable selectors for similar elements', async () => {
    // Setup HTML with similar elements
    await testPage.setContent(`
      <html>
        <body>
          <table>
            <tr>
              <td class="cell">A1</td>
              <td class="cell">A2</td>
            </tr>
            <tr>
              <td class="cell">B1</td>
              <td class="cell">B2</td>
            </tr>
          </table>
        </body>
      </html>
    `);

    const cellA2 = await testPage.evaluateHandle(() => {
      return document.querySelectorAll('td.cell')[1]; // A2
    });

    const selector = await (elementDiscovery as any).generateSelector(cellA2);

    // Should be specific enough to identify A2 uniquely
    expect(selector).toMatch(/:nth-child\(2\)|:nth-of-type\(2\)|tr.*td/);

    // Verify selector uniqueness - should match only one element
    const matchedElements = await testPage.$$(selector);
    expect(matchedElements).toHaveLength(1);

    // Verify we got the right element (A2)
    const elementText = await matchedElements[0].textContent();
    expect(elementText).toBe('A2');
  });

  test('should handle complex selectors with multiple identifying attributes', async () => {
    // Setup HTML with multiple attributes
    await testPage.setContent(`
      <html>
        <body>
          <form class="login-form">
            <input type="text" class="form-control" name="username" aria-label="Username" required>
            <input type="email" class="form-control" name="email" aria-label="Email" required>
          </form>
          <form class="signup-form">
            <input type="text" class="form-control" name="username" aria-label="Username" required>
          </form>
        </body>
      </html>
    `);

    const loginEmail = await testPage.$('.login-form input[name="email"]');
    expect(loginEmail).not.toBeNull();

    const selector = await (elementDiscovery as any).generateSelector(
      loginEmail
    );

    // Should be unique and include distinguishing attributes
    expect(selector).toMatch(/email|login-form/);

    // Verify selector uniqueness - should match only one element
    const matchedElements = await testPage.$$(selector);
    expect(matchedElements).toHaveLength(1);
  });

  test('should validate selector uniqueness during generation', async () => {
    // Setup HTML to test selector validation
    await testPage.setContent(`
      <html>
        <body>
          <div class="item" data-id="1">Item 1</div>
          <div class="item" data-id="2">Item 2</div>
          <div class="item" data-id="3">Item 3</div>
        </body>
      </html>
    `);

    const item2 = await testPage.$('[data-id="2"]');
    expect(item2).not.toBeNull();

    const selector = await (elementDiscovery as any).generateSelector(item2);

    // Should not return generic 'div.item' which would match multiple elements
    expect(selector).not.toBe('div.item');

    // Should include data-id for uniqueness
    expect(selector).toMatch(/data-id="2"/);

    // Verify selector uniqueness - should match only one element
    const matchedElements = await testPage.$$(selector);
    expect(matchedElements).toHaveLength(1);
  });
});
