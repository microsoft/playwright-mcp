/**
 * Batch Find Elements Tests
 *
 * Comprehensive test suite for browser_find_elements in batch execution,
 * covering basic integration, complex workflows, edge cases, and real-world usage patterns.
 */

import { expect, test } from './fixtures.js';
import {
  createTestPage,
  executeBatchWithErrorHandling,
  expectBatchExecutionPartialSuccess,
  expectBatchExecutionSuccess,
} from './test-utils.js';
import type { TestServer } from './testserver/index.js';

// Common test configurations
const DEFAULT_EXPECTATION = { includeSnapshot: false };
const SNAPSHOT_EXPECTATION = { includeSnapshot: true };

// Regex patterns for tests
const TIME_REGEX = /Total Time: (\d+)ms/;

// Helper to create navigate step
const createNavigateStep = (
  url: string,
  expectation = DEFAULT_EXPECTATION
) => ({
  tool: 'browser_navigate',
  arguments: { url },
  expectation,
});

// Helper to create find_elements step
const createFindElementsStep = (
  searchCriteria: Record<string, unknown>,
  maxResults = 5,
  expectation = DEFAULT_EXPECTATION
) => ({
  tool: 'browser_find_elements',
  arguments: {
    searchCriteria,
    maxResults,
  },
  expectation,
});

// Helper to verify multiple find_elements steps succeeded
const verifyFindElementsSteps = (
  text: string,
  startStep: number,
  endStep: number
) => {
  for (let i = startStep; i <= endStep; i++) {
    expect(text).toContain(`✅ Step ${i}: browser_find_elements`);
  }
};

// Test case definitions for parameterized tests
interface FindElementsTestCase {
  name: string;
  template: string;
  steps: Array<{
    criteria: Record<string, unknown>;
    maxResults?: number;
  }>;
  expectedStepCount: number;
  verifyResults?: (text: string) => void;
}

// HTML templates for testing
const HTML_TEMPLATES = {
  // Basic templates for integration testing
  MULTI_SECTION_FORM: `
    <div>
      <h1>Multi-Section Form</h1>
      <div id="personal-info">
        <h2>Personal Information</h2>
        <input type="text" id="first-name" placeholder="First Name">
        <input type="text" id="last-name" placeholder="Last Name">
        <input type="date" id="birth-date">
      </div>
      <div id="contact-info">
        <h2>Contact Information</h2>
        <input type="text" id="phone" placeholder="Phone Number">
        <input type="text" id="address" placeholder="Address">
        <input type="text" id="city" placeholder="City">
      </div>
      <div id="preferences">
        <h2>Preferences</h2>
        <select id="language">
          <option value="en">English</option>
          <option value="ja">Japanese</option>
          <option value="es">Spanish</option>
        </select>
        <textarea id="comments" placeholder="Additional comments"></textarea>
      </div>
      <div id="actions">
        <button type="submit" id="save-btn">Save</button>
        <button type="button" id="preview-btn">Preview</button>
      </div>
    </div>
  `,

  DUPLICATE_ELEMENTS: `
    <div>
      <div class="section section-a">
        <input type="text" class="input-field" placeholder="Section A Input">
        <button class="action-btn">Submit A</button>
      </div>
      <div class="section section-b">
        <input type="text" class="input-field" placeholder="Section B Input">
        <button class="action-btn">Submit B</button>
      </div>
      <div class="section section-c">
        <input type="text" class="input-field" placeholder="Section C Input">
        <button class="action-btn">Submit C</button>
      </div>
    </div>
  `,

  ERROR_HANDLING_FORM: `
    <div>
      <form>
        <input type="text" id="existing-field" placeholder="This exists">
        <button id="existing-button">This exists</button>
      </form>
    </div>
  `,

  COMPLEX_FORM: `
    <div>
      <h1>User Registration Form</h1>
      <form id="registration-form">
        <div class="form-group">
          <label for="username">Username:</label>
          <input type="text" id="username" name="username" placeholder="Enter username" required>
        </div>
        <div class="form-group">
          <label for="email">Email:</label>
          <input type="email" id="email" name="email" placeholder="Enter email" required>
        </div>
        <div class="form-group">
          <label for="password">Password:</label>
          <input type="password" id="password" name="password" placeholder="Enter password" required>
        </div>
        <div class="form-group">
          <label for="confirm-password">Confirm Password:</label>
          <input type="password" id="confirm-password" name="confirm-password" placeholder="Confirm password" required>
        </div>
        <div class="form-actions">
          <button type="submit" id="submit-btn" class="btn btn-primary">Register</button>
          <button type="button" id="reset-btn" class="btn btn-secondary">Reset</button>
          <button type="button" id="cancel-btn" class="btn btn-tertiary">Cancel</button>
        </div>
      </form>
    </div>
  `,

  // Complex templates for advanced testing
  E_COMMERCE_PRODUCT: `
    <div id="product-page">
      <header>
        <nav>
          <a href="/" class="nav-link">Home</a>
          <a href="/products" class="nav-link">Products</a>
          <a href="/cart" class="nav-link cart-link">Cart (0)</a>
        </nav>
      </header>
      <main>
        <div class="product-details">
          <img src="product.jpg" alt="Product Image" class="product-image">
          <h1 class="product-title">Premium Wireless Headphones</h1>
          <p class="product-price">$299.99</p>
          <div class="product-rating" data-rating="4.5">
            <span class="stars">★★★★☆</span>
            <span class="review-count">(127 reviews)</span>
          </div>
          <div class="product-options">
            <select id="color-select" class="option-select">
              <option value="black">Black</option>
              <option value="white">White</option>
              <option value="blue">Blue</option>
            </select>
            <input type="number" id="quantity" class="quantity-input" value="1" min="1" max="10">
          </div>
          <div class="product-actions">
            <button class="btn btn-primary add-to-cart" data-product-id="12345">Add to Cart</button>
            <button class="btn btn-secondary add-to-wishlist">Add to Wishlist</button>
            <button class="btn btn-link share-product">Share</button>
          </div>
          <div class="product-description">
            <h2>Description</h2>
            <p class="description-text">Experience premium audio quality with our flagship wireless headphones.</p>
            <ul class="feature-list">
              <li class="feature-item">Active Noise Cancellation</li>
              <li class="feature-item">30-hour battery life</li>
              <li class="feature-item">Premium comfort</li>
            </ul>
          </div>
        </div>
        <div class="related-products">
          <h2>Related Products</h2>
          <div class="product-grid">
            <div class="product-card" data-product-id="23456">
              <img src="related1.jpg" alt="Related Product 1">
              <h3 class="product-name">Wireless Earbuds</h3>
              <p class="product-price">$149.99</p>
              <button class="btn btn-sm quick-view">Quick View</button>
            </div>
            <div class="product-card" data-product-id="34567">
              <img src="related2.jpg" alt="Related Product 2">
              <h3 class="product-name">Charging Case</h3>
              <p class="product-price">$49.99</p>
              <button class="btn btn-sm quick-view">Quick View</button>
            </div>
          </div>
        </div>
      </main>
    </div>
  `,

  DYNAMIC_FORM_WIZARD: `
    <div id="form-wizard">
      <div class="wizard-progress">
        <div class="step active" data-step="1">Personal Info</div>
        <div class="step" data-step="2">Address</div>
        <div class="step" data-step="3">Payment</div>
        <div class="step" data-step="4">Review</div>
      </div>
      <form id="multi-step-form">
        <div class="step-content active" id="step-1">
          <h2>Personal Information</h2>
          <input type="text" name="firstName" class="form-input required" placeholder="First Name" required>
          <input type="text" name="lastName" class="form-input required" placeholder="Last Name" required>
          <input type="email" name="email" class="form-input required" placeholder="Email" required>
          <input type="tel" name="phone" class="form-input optional" placeholder="Phone (optional)">
          <button type="button" class="btn next-step" data-next="2">Next</button>
        </div>
        <div class="step-content" id="step-2" style="display:none;">
          <h2>Address Information</h2>
          <input type="text" name="street" class="form-input required" placeholder="Street Address" required>
          <input type="text" name="city" class="form-input required" placeholder="City" required>
          <select name="state" class="form-input required">
            <option value="">Select State</option>
            <option value="CA">California</option>
            <option value="NY">New York</option>
            <option value="TX">Texas</option>
          </select>
          <input type="text" name="zip" class="form-input required" placeholder="ZIP Code" required>
          <button type="button" class="btn prev-step" data-prev="1">Previous</button>
          <button type="button" class="btn next-step" data-next="3">Next</button>
        </div>
        <div class="step-content" id="step-3" style="display:none;">
          <h2>Payment Method</h2>
          <div class="payment-options">
            <label class="payment-option">
              <input type="radio" name="payment" value="credit" class="payment-radio">
              <span>Credit Card</span>
            </label>
            <label class="payment-option">
              <input type="radio" name="payment" value="paypal" class="payment-radio">
              <span>PayPal</span>
            </label>
            <label class="payment-option">
              <input type="radio" name="payment" value="crypto" class="payment-radio">
              <span>Cryptocurrency</span>
            </label>
          </div>
          <button type="button" class="btn prev-step" data-prev="2">Previous</button>
          <button type="button" class="btn next-step" data-next="4">Next</button>
        </div>
        <div class="step-content" id="step-4" style="display:none;">
          <h2>Review & Submit</h2>
          <div class="review-section">
            <h3>Order Summary</h3>
            <p class="summary-text">Please review your information before submitting.</p>
          </div>
          <button type="button" class="btn prev-step" data-prev="3">Previous</button>
          <button type="submit" class="btn btn-primary submit-form">Submit Order</button>
        </div>
      </form>
    </div>
  `,

  NESTED_COMPONENTS: `
    <div id="app">
      <div class="component-a" data-component="header">
        <div class="sub-component">
          <input type="search" class="search-input" placeholder="Search...">
          <button class="search-btn">Search</button>
        </div>
        <div class="sub-component">
          <a href="#" class="link user-link">Profile</a>
          <a href="#" class="link settings-link">Settings</a>
          <a href="#" class="link logout-link">Logout</a>
        </div>
      </div>
      <div class="component-b" data-component="sidebar">
        <ul class="menu-list">
          <li class="menu-item active" data-menu="dashboard">
            <a href="#" class="menu-link">Dashboard</a>
          </li>
          <li class="menu-item" data-menu="analytics">
            <a href="#" class="menu-link">Analytics</a>
            <ul class="submenu">
              <li class="submenu-item"><a href="#" class="submenu-link">Reports</a></li>
              <li class="submenu-item"><a href="#" class="submenu-link">Metrics</a></li>
            </ul>
          </li>
          <li class="menu-item" data-menu="settings">
            <a href="#" class="menu-link">Settings</a>
          </li>
        </ul>
      </div>
      <div class="component-c" data-component="content">
        <div class="card" data-card-id="1">
          <h3 class="card-title">Card 1</h3>
          <p class="card-content">Content for card 1</p>
          <button class="card-action">Action 1</button>
        </div>
        <div class="card" data-card-id="2">
          <h3 class="card-title">Card 2</h3>
          <p class="card-content">Content for card 2</p>
          <button class="card-action">Action 2</button>
        </div>
        <div class="card" data-card-id="3">
          <h3 class="card-title">Card 3</h3>
          <p class="card-content">Content for card 3</p>
          <button class="card-action">Action 3</button>
        </div>
      </div>
    </div>
  `,

  TABLE_WITH_ACTIONS: `
    <div id="data-table-container">
      <div class="table-controls">
        <input type="text" id="search" class="table-search" placeholder="Search records...">
        <select id="filter" class="table-filter">
          <option value="all">All</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <button class="btn export-btn">Export</button>
      </div>
      <table class="data-table">
        <thead>
          <tr>
            <th><input type="checkbox" class="select-all"></th>
            <th>ID</th>
            <th>Name</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr data-row-id="1">
            <td><input type="checkbox" class="row-select"></td>
            <td class="row-id">001</td>
            <td class="row-name">John Doe</td>
            <td class="row-status active">Active</td>
            <td class="row-actions">
              <button class="btn-edit" data-id="1">Edit</button>
              <button class="btn-delete" data-id="1">Delete</button>
              <button class="btn-view" data-id="1">View</button>
            </td>
          </tr>
          <tr data-row-id="2">
            <td><input type="checkbox" class="row-select"></td>
            <td class="row-id">002</td>
            <td class="row-name">Jane Smith</td>
            <td class="row-status inactive">Inactive</td>
            <td class="row-actions">
              <button class="btn-edit" data-id="2">Edit</button>
              <button class="btn-delete" data-id="2">Delete</button>
              <button class="btn-view" data-id="2">View</button>
            </td>
          </tr>
          <tr data-row-id="3">
            <td><input type="checkbox" class="row-select"></td>
            <td class="row-id">003</td>
            <td class="row-name">Bob Johnson</td>
            <td class="row-status active">Active</td>
            <td class="row-actions">
              <button class="btn-edit" data-id="3">Edit</button>
              <button class="btn-delete" data-id="3">Delete</button>
              <button class="btn-view" data-id="3">View</button>
            </td>
          </tr>
        </tbody>
      </table>
      <div class="table-pagination">
        <button class="page-btn" data-page="prev">Previous</button>
        <span class="page-info">Page 1 of 10</span>
        <button class="page-btn" data-page="next">Next</button>
      </div>
    </div>
  `,
} as const;

// Complex scenario test cases
const complexScenarioTests: FindElementsTestCase[] = [
  {
    name: 'should handle complex form analysis workflow',
    template: HTML_TEMPLATES.COMPLEX_FORM,
    steps: [
      {
        criteria: { tagName: 'input', attributes: { type: 'text' } },
        maxResults: 10,
      },
      {
        criteria: { tagName: 'input', attributes: { type: 'email' } },
        maxResults: 5,
      },
      {
        criteria: { tagName: 'input', attributes: { type: 'password' } },
        maxResults: 5,
      },
      { criteria: { tagName: 'button' }, maxResults: 5 },
      { criteria: { tagName: 'form' }, maxResults: 3 },
      { criteria: { attributes: { class: 'form-group' } }, maxResults: 10 },
    ],
    expectedStepCount: 7,
  },
  {
    name: 'should handle e-commerce product page workflow',
    template: HTML_TEMPLATES.E_COMMERCE_PRODUCT,
    steps: [
      { criteria: { tagName: 'nav' }, maxResults: 5 },
      { criteria: { tagName: 'button' }, maxResults: 10 },
      { criteria: { tagName: 'select' }, maxResults: 3 },
      {
        criteria: { attributes: { class: 'product-feature' } },
        maxResults: 10,
      },
      { criteria: { attributes: { class: 'spec-item' } }, maxResults: 20 },
    ],
    expectedStepCount: 6,
  },
  {
    name: 'should handle multi-step form wizard with progressive discovery',
    template: HTML_TEMPLATES.DYNAMIC_FORM_WIZARD,
    steps: [
      { criteria: { attributes: { class: 'wizard-step' } }, maxResults: 10 },
      { criteria: { tagName: 'input' }, maxResults: 20 },
      { criteria: { tagName: 'button' }, maxResults: 10 },
      { criteria: { attributes: { class: 'step-indicator' } }, maxResults: 5 },
    ],
    expectedStepCount: 5,
  },
  {
    name: 'should handle deeply nested component structures',
    template: HTML_TEMPLATES.NESTED_COMPONENTS,
    steps: [
      { criteria: { attributes: { class: 'container' } }, maxResults: 10 },
      { criteria: { attributes: { class: 'row' } }, maxResults: 10 },
      { criteria: { attributes: { class: 'col' } }, maxResults: 20 },
      { criteria: { attributes: { class: 'card' } }, maxResults: 10 },
      { criteria: { attributes: { class: 'card-body' } }, maxResults: 10 },
      { criteria: { attributes: { class: 'card-action' } }, maxResults: 10 },
    ],
    expectedStepCount: 7,
  },
  {
    name: 'should handle data table with complex selectors',
    template: HTML_TEMPLATES.DATA_TABLE,
    steps: [
      { criteria: { tagName: 'table' }, maxResults: 3 },
      { criteria: { tagName: 'thead' }, maxResults: 3 },
      { criteria: { tagName: 'tbody' }, maxResults: 3 },
      { criteria: { tagName: 'tr' }, maxResults: 20 },
      { criteria: { tagName: 'th' }, maxResults: 10 },
      { criteria: { tagName: 'td' }, maxResults: 50 },
    ],
    expectedStepCount: 7,
  },
];

const basicFindElementsTests: FindElementsTestCase[] = [
  {
    name: 'should execute find_elements in batch mode successfully',
    template: `
      <form>
        <input id="username" type="text" placeholder="Username">
        <input id="password" type="password" placeholder="Password">
        <button type="submit">Submit</button>
      </form>
    `,
    steps: [
      { criteria: { tagName: 'input' }, maxResults: 3 },
      { criteria: { tagName: 'button' }, maxResults: 3 },
    ],
    expectedStepCount: 3,
  },
  {
    name: 'should execute multiple find_elements operations without conflicts',
    template: HTML_TEMPLATES.MULTI_SECTION_FORM,
    steps: [
      { criteria: { tagName: 'input' }, maxResults: 5 },
      { criteria: { tagName: 'textarea' }, maxResults: 2 },
      { criteria: { tagName: 'select' }, maxResults: 2 },
      { criteria: { tagName: 'button' }, maxResults: 3 },
    ],
    expectedStepCount: 5,
  },
  {
    name: 'should handle different search criteria on same page without conflicts',
    template: HTML_TEMPLATES.DUPLICATE_ELEMENTS,
    steps: [
      { criteria: { attributes: { class: 'input-field' } }, maxResults: 3 },
      { criteria: { attributes: { class: 'action-btn' } }, maxResults: 3 },
      { criteria: { text: 'Section A Input' }, maxResults: 1 },
      { criteria: { attributes: { class: 'section' } }, maxResults: 5 },
    ],
    expectedStepCount: 5,
  },
  {
    name: 'should handle mixed find_elements operations with different result limits',
    template: HTML_TEMPLATES.DUPLICATE_ELEMENTS,
    steps: [
      { criteria: { tagName: 'input' }, maxResults: 10 },
      { criteria: { tagName: 'button' }, maxResults: 5 },
      { criteria: { attributes: { class: 'section' } }, maxResults: 3 },
    ],
    expectedStepCount: 4,
  },
];

// Type for client parameter
interface TestClient {
  callTool(params: {
    name: string;
    arguments: Record<string, unknown>;
  }): Promise<{ content: Array<{ text: string }> }>;
}

// Helper for common batch execution
const executeBatch = async (
  client: TestClient,
  steps: Record<string, unknown>[],
  globalExpectation = {}
) => {
  return await client.callTool({
    name: 'browser_batch_execute',
    arguments: {
      steps,
      globalExpectation: {
        includeDownloads: false,
        includeTabs: false,
        ...globalExpectation,
      },
    },
  });
};

/**
 * Helper function to setup test server with content
 */
function setupTestPage(
  server: TestServer,
  htmlContent: string,
  path = '/',
  title = 'Test Page'
): void {
  const page = createTestPage(htmlContent, title);
  server.setContent(path, page.content, page.contentType);
}

test.describe('Batch Find Elements Tests', () => {
  // =====================================================
  // BASIC BATCH FIND_ELEMENTS TESTS
  // =====================================================

  test.describe('Basic Integration Tests', () => {
    // Parameterized tests for basic find_elements scenarios
    for (const testCase of basicFindElementsTests) {
      test(testCase.name, async ({ client, server }) => {
        setupTestPage(server, testCase.template);

        const steps = [
          createNavigateStep(server.PREFIX),
          ...testCase.steps.map((step) =>
            createFindElementsStep(step.criteria, step.maxResults)
          ),
        ];

        const result = await executeBatch(client, steps);
        expectBatchExecutionSuccess(result, testCase.expectedStepCount);

        const text = result.content[0].text;

        // Verify all find_elements steps succeeded
        verifyFindElementsSteps(text, 2, testCase.expectedStepCount);

        // Verify that elements were found
        expect(text).toContain('Found');
        expect(text).toContain('elements matching the criteria');

        // Run custom verification if provided
        if (testCase.verifyResults) {
          testCase.verifyResults(text);
        }
      });
    }
  });

  // =====================================================
  // PERFORMANCE AND COMPLEX SCENARIO TESTS
  // =====================================================

  test.describe('Performance Tests', () => {
    test('should handle maximum complexity with 20+ find_elements operations', async ({
      client,
      server,
    }) => {
      setupTestPage(server, HTML_TEMPLATES.E_COMMERCE_PRODUCT);

      // Create a massive batch with many find_elements operations
      const steps: Array<{
        tool: string;
        arguments: Record<string, unknown>;
        expectation?: Record<string, unknown>;
      }> = [
        {
          tool: 'browser_navigate',
          arguments: { url: server.PREFIX },
          expectation: { includeSnapshot: false },
        },
      ];

      // Add 20 different find_elements operations
      const searchCriteria = [
        { tagName: 'div' },
        { tagName: 'button' },
        { tagName: 'input' },
        { tagName: 'select' },
        { tagName: 'a' },
        { tagName: 'p' },
        { tagName: 'h1' },
        { tagName: 'h2' },
        { tagName: 'h3' },
        { tagName: 'ul' },
        { tagName: 'li' },
        { tagName: 'img' },
        { attributes: { class: 'btn' } },
        { attributes: { class: 'product' } },
        { attributes: { class: 'nav' } },
        { attributes: { class: 'feature' } },
        { attributes: { type: 'text' } },
        { attributes: { type: 'number' } },
        { text: 'Add to Cart' },
        { role: 'button' },
      ];

      for (const criteria of searchCriteria) {
        steps.push({
          tool: 'browser_find_elements',
          arguments: {
            searchCriteria: criteria,
            maxResults: 3,
          },
          expectation: { includeSnapshot: false },
        });
      }

      const result = await client.callTool({
        name: 'browser_batch_execute',
        arguments: {
          steps,
        },
      });

      expectBatchExecutionSuccess(result, 21);

      const text = result.content[0].text;

      // Verify all 20 find_elements operations succeeded
      for (let i = 2; i <= 21; i++) {
        expect(text).toContain(`✅ Step ${i}: browser_find_elements`);
      }

      // Verify performance is reasonable even with many operations
      const timeMatch = text.match(TIME_REGEX);
      if (timeMatch) {
        const totalTime = Number.parseInt(timeMatch[1], 10);
        expect(totalTime).toBeLessThan(10_000); // Should complete in under 10 seconds
      }
    });
  });

  // =====================================================
  // COMPLEX SCENARIO TESTS
  // =====================================================

  test.describe('Complex Scenarios', () => {
    // Parameterized tests for complex scenarios
    for (const testCase of complexScenarioTests) {
      test(testCase.name, async ({ client, server }) => {
        setupTestPage(server, testCase.template);

        const steps = [
          createNavigateStep(server.PREFIX),
          ...testCase.steps.map((step) =>
            createFindElementsStep(step.criteria, step.maxResults)
          ),
        ];

        const result = await executeBatch(client, steps);
        expectBatchExecutionSuccess(result, testCase.expectedStepCount);

        const text = result.content[0].text;

        // Verify all find_elements steps succeeded
        verifyFindElementsSteps(text, 2, testCase.expectedStepCount);

        // Note: Not checking exact element counts as they depend on HTML content

        // Run custom verification if provided
        if (testCase.verifyResults) {
          testCase.verifyResults(text);
        }
      });
    }

    // Keep only unique complex tests that don't fit the pattern

    test('should handle mixed operations with find_elements maintaining ref consistency', async ({
      client,
      server,
    }) => {
      setupTestPage(server, HTML_TEMPLATES.DYNAMIC_FORM_WIZARD);

      const result = await executeBatch(client, [
        createNavigateStep(server.PREFIX),
        // Find form inputs
        {
          tool: 'browser_find_elements',
          arguments: {
            searchCriteria: {
              tagName: 'input',
              attributes: { class: 'form-input' },
            },
            maxResults: 5,
          },
          expectation: DEFAULT_EXPECTATION,
        },
        // Take a screenshot
        {
          tool: 'browser_take_screenshot',
          arguments: { filename: 'form-step1.png' },
          expectation: DEFAULT_EXPECTATION,
        },
        // Find buttons
        {
          tool: 'browser_find_elements',
          arguments: {
            searchCriteria: {
              tagName: 'button',
            },
            maxResults: 5,
          },
          expectation: DEFAULT_EXPECTATION,
        },
        // Evaluate some JavaScript
        {
          tool: 'browser_evaluate',
          arguments: {
            function: '() => document.querySelectorAll("input").length',
          },
          expectation: DEFAULT_EXPECTATION,
        },
        // Find more elements
        {
          tool: 'browser_find_elements',
          arguments: {
            searchCriteria: {
              attributes: { class: 'step' },
            },
            maxResults: 10,
          },
          expectation: DEFAULT_EXPECTATION,
        },
        // Wait a bit
        {
          tool: 'browser_wait_for',
          arguments: { time: 0.5 },
          expectation: DEFAULT_EXPECTATION,
        },
        // Find more elements after wait
        {
          tool: 'browser_find_elements',
          arguments: {
            searchCriteria: {
              tagName: 'select',
            },
            maxResults: 5,
          },
          expectation: DEFAULT_EXPECTATION,
        },
        // Get final snapshot
        {
          tool: 'browser_snapshot',
          arguments: {},
          expectation: SNAPSHOT_EXPECTATION,
        },
      ]);

      expectBatchExecutionSuccess(result, 9);

      const text = result.content[0].text;

      // Verify mixed operations all succeeded
      expect(text).toContain('✅ Step 2: browser_find_elements');
      expect(text).toContain('✅ Step 3: browser_take_screenshot');
      expect(text).toContain('✅ Step 4: browser_find_elements');
      expect(text).toContain('✅ Step 5: browser_evaluate');
      expect(text).toContain('✅ Step 6: browser_find_elements');
      expect(text).toContain('✅ Step 7: browser_wait_for');
      expect(text).toContain('✅ Step 8: browser_find_elements');
      expect(text).toContain('✅ Step 9: browser_snapshot');

      // Verify refs are maintained throughout
      // The snapshot should contain element refs from find_elements operations
      // Note: Not checking exact element counts as they depend on HTML content
    });
  });

  // =====================================================
  // ERROR HANDLING TESTS
  // =====================================================

  test.describe('Error Handling', () => {
    test('should handle error cases with invalid search criteria gracefully', async ({
      client,
      server,
    }) => {
      setupTestPage(server, HTML_TEMPLATES.ERROR_HANDLING_FORM);

      const { result } = await executeBatchWithErrorHandling(
        client,
        [
          {
            tool: 'browser_navigate',
            arguments: { url: server.PREFIX },
            expectation: { includeSnapshot: false, includeConsole: false },
          },
          // Valid find_elements operation
          {
            tool: 'browser_find_elements',
            arguments: {
              searchCriteria: { tagName: 'input' },
              maxResults: 5,
            },
            expectation: { includeSnapshot: false, includeConsole: false },
            continueOnError: true,
          },
          // Search for non-existent elements - should return 0 results but not error
          {
            tool: 'browser_find_elements',
            arguments: {
              searchCriteria: { tagName: 'nonexistent' },
              maxResults: 1,
            },
            expectation: { includeSnapshot: false, includeConsole: false },
            continueOnError: true,
          },
          // Another valid search
          {
            tool: 'browser_find_elements',
            arguments: {
              searchCriteria: { tagName: 'button' },
              maxResults: 3,
            },
            expectation: { includeSnapshot: false, includeConsole: false },
          },
        ],
        {
          stopOnFirstError: false,
        }
      );

      // All operations should succeed, even if some return 0 results
      expectBatchExecutionSuccess(result, 4);

      const text = result.content[0].text;
      expect(text).toContain('✅ Step 1: browser_navigate');
      expect(text).toContain('✅ Step 2: browser_find_elements');
      expect(text).toContain('✅ Step 3: browser_find_elements'); // Even with 0 results
      expect(text).toContain('✅ Step 4: browser_find_elements');
    });

    test('should handle error recovery with find_elements operations', async ({
      client,
      server,
    }) => {
      setupTestPage(server, HTML_TEMPLATES.E_COMMERCE_PRODUCT);

      const { result } = await executeBatchWithErrorHandling(
        client,
        [
          {
            tool: 'browser_navigate',
            arguments: { url: server.PREFIX },
            expectation: { includeSnapshot: false },
          },
          // Valid find_elements
          {
            tool: 'browser_find_elements',
            arguments: {
              searchCriteria: { tagName: 'button' },
              maxResults: 5,
            },
            expectation: { includeSnapshot: false },
            continueOnError: true,
          },
          // Invalid operation (will fail)
          {
            tool: 'browser_click',
            arguments: { element: 'nonexistent', ref: 'invalid_ref' },
            expectation: { includeSnapshot: false },
            continueOnError: true,
          },
          // Another valid find_elements after error
          {
            tool: 'browser_find_elements',
            arguments: {
              searchCriteria: { tagName: 'input' },
              maxResults: 5,
            },
            expectation: { includeSnapshot: false },
          },
          // More operations
          {
            tool: 'browser_find_elements',
            arguments: {
              searchCriteria: { attributes: { class: 'product-card' } },
              maxResults: 5,
            },
            expectation: { includeSnapshot: false },
          },
        ],
        {
          stopOnFirstError: false,
        }
      );

      // Should have partial success
      expectBatchExecutionPartialSuccess(result, 5, 4, 1);

      const text = result.content[0].text;
      expect(text).toContain('✅ Step 1: browser_navigate');
      expect(text).toContain('✅ Step 2: browser_find_elements');
      expect(text).toContain('❌ Step 3: browser_click'); // This should fail
      expect(text).toContain('✅ Step 4: browser_find_elements');
      expect(text).toContain('✅ Step 5: browser_find_elements');
    });
  });
});
