/**
 * Complex Batch Find Elements Tests
 *
 * Advanced test scenarios for browser_find_elements in batch execution
 * including complex workflows, edge cases, and real-world usage patterns.
 */

import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { expect, test } from './fixtures.js';
import {
  createTestPage,
  executeBatchWithErrorHandling,
  expectBatchExecutionPartialSuccess,
  expectBatchExecutionSuccess,
} from './test-utils.js';
import type { TestServer } from './testserver/index.js';

// type CallToolResponse = Awaited<ReturnType<Client['callTool']>>; // Kept for potential future use

// Complex HTML templates for advanced testing
const COMPLEX_HTML_TEMPLATES = {
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

/**
 * Helper function to setup test server with content
 */
function setupTestPage(
  server: TestServer,
  htmlContent: string,
  path = '/'
): void {
  const page = createTestPage(htmlContent, 'Complex Test Page');
  server.setContent(path, page.content, page.contentType);
}

test.describe('Complex Batch Find Elements Tests', () => {
  test('should handle e-commerce product page workflow', async ({
    client,
    server,
  }) => {
    setupTestPage(server, COMPLEX_HTML_TEMPLATES.E_COMMERCE_PRODUCT);

    const result = await client.callTool({
      name: 'browser_batch_execute',
      arguments: {
        steps: [
          {
            tool: 'browser_navigate',
            arguments: { url: server.PREFIX },
            expectation: { includeSnapshot: false },
          },
          // Find all navigation links
          {
            tool: 'browser_find_elements',
            arguments: {
              searchCriteria: { attributes: { class: 'nav-link' } },
              maxResults: 5,
            },
            expectation: { includeSnapshot: false },
          },
          // Find product action buttons
          {
            tool: 'browser_find_elements',
            arguments: {
              searchCriteria: {
                tagName: 'button',
                attributes: { class: 'btn' },
              },
              maxResults: 10,
            },
            expectation: { includeSnapshot: false },
          },
          // Find product options (selects and inputs)
          {
            tool: 'browser_find_elements',
            arguments: {
              searchCriteria: { attributes: { class: 'option-select' } },
              maxResults: 3,
            },
            expectation: { includeSnapshot: false },
          },
          // Find feature list items
          {
            tool: 'browser_find_elements',
            arguments: {
              searchCriteria: { attributes: { class: 'feature-item' } },
              maxResults: 5,
            },
            expectation: { includeSnapshot: false },
          },
          // Find related product cards
          {
            tool: 'browser_find_elements',
            arguments: {
              searchCriteria: { attributes: { class: 'product-card' } },
              maxResults: 10,
            },
            expectation: { includeSnapshot: false },
          },
          // Get a final snapshot to see all refs
          {
            tool: 'browser_snapshot',
            arguments: {},
            expectation: { includeSnapshot: true },
          },
        ],
        globalExpectation: {
          includeDownloads: false,
          includeTabs: false,
        },
      },
    });

    expectBatchExecutionSuccess(result, 7);

    const text = result.content[0].text;

    // Verify all find_elements operations succeeded
    expect(text).toContain('✅ Step 2: browser_find_elements'); // nav links
    expect(text).toContain('✅ Step 3: browser_find_elements'); // buttons
    expect(text).toContain('✅ Step 4: browser_find_elements'); // selects
    expect(text).toContain('✅ Step 5: browser_find_elements'); // features
    expect(text).toContain('✅ Step 6: browser_find_elements'); // products

    // Verify that multiple elements were found
    const foundMatches =
      text.match(/Found \d+ elements matching the criteria/g) || [];
    expect(foundMatches.length).toBeGreaterThanOrEqual(5);
  });

  test('should handle multi-step form wizard with progressive discovery', async ({
    client,
    server,
  }) => {
    setupTestPage(server, COMPLEX_HTML_TEMPLATES.DYNAMIC_FORM_WIZARD);

    const result = await client.callTool({
      name: 'browser_batch_execute',
      arguments: {
        steps: [
          {
            tool: 'browser_navigate',
            arguments: { url: server.PREFIX },
            expectation: { includeSnapshot: false },
          },
          // Find all form inputs in step 1
          {
            tool: 'browser_find_elements',
            arguments: {
              searchCriteria: {
                tagName: 'input',
                attributes: { class: 'form-input' },
              },
              maxResults: 10,
            },
            expectation: { includeSnapshot: false },
          },
          // Find required fields specifically
          {
            tool: 'browser_find_elements',
            arguments: {
              searchCriteria: {
                attributes: { class: 'required' },
              },
              maxResults: 15,
            },
            expectation: { includeSnapshot: false },
          },
          // Find navigation buttons
          {
            tool: 'browser_find_elements',
            arguments: {
              searchCriteria: {
                attributes: { class: 'next-step' },
              },
              maxResults: 5,
            },
            expectation: { includeSnapshot: false },
          },
          // Find all step indicators
          {
            tool: 'browser_find_elements',
            arguments: {
              searchCriteria: {
                attributes: { class: 'step' },
              },
              maxResults: 10,
            },
            expectation: { includeSnapshot: false },
          },
          // Find payment options
          {
            tool: 'browser_find_elements',
            arguments: {
              searchCriteria: {
                attributes: { class: 'payment-radio' },
              },
              maxResults: 5,
            },
            expectation: { includeSnapshot: false },
          },
        ],
        globalExpectation: {
          includeDownloads: false,
          includeTabs: false,
        },
      },
    });

    expectBatchExecutionSuccess(result, 6);

    // Verify form analysis workflow succeeded
    const text = result.content[0].text;
    for (let i = 2; i <= 6; i++) {
      expect(text).toContain(`✅ Step ${i}: browser_find_elements`);
    }
  });

  test('should handle deeply nested component structures', async ({
    client,
    server,
  }) => {
    setupTestPage(server, COMPLEX_HTML_TEMPLATES.NESTED_COMPONENTS);

    const result = await client.callTool({
      name: 'browser_batch_execute',
      arguments: {
        steps: [
          {
            tool: 'browser_navigate',
            arguments: { url: server.PREFIX },
            expectation: { includeSnapshot: false },
          },
          // Find top-level components
          {
            tool: 'browser_find_elements',
            arguments: {
              searchCriteria: {
                attributes: { 'data-component': 'header' },
              },
              maxResults: 5,
            },
            expectation: { includeSnapshot: false },
          },
          // Find menu items
          {
            tool: 'browser_find_elements',
            arguments: {
              searchCriteria: {
                attributes: { class: 'menu-item' },
              },
              maxResults: 10,
            },
            expectation: { includeSnapshot: false },
          },
          // Find submenu items (nested)
          {
            tool: 'browser_find_elements',
            arguments: {
              searchCriteria: {
                attributes: { class: 'submenu-item' },
              },
              maxResults: 10,
            },
            expectation: { includeSnapshot: false },
          },
          // Find cards
          {
            tool: 'browser_find_elements',
            arguments: {
              searchCriteria: {
                attributes: { class: 'card' },
              },
              maxResults: 10,
            },
            expectation: { includeSnapshot: false },
          },
          // Find all links
          {
            tool: 'browser_find_elements',
            arguments: {
              searchCriteria: {
                tagName: 'a',
                attributes: { class: 'link' },
              },
              maxResults: 20,
            },
            expectation: { includeSnapshot: false },
          },
          // Find card action buttons
          {
            tool: 'browser_find_elements',
            arguments: {
              searchCriteria: {
                attributes: { class: 'card-action' },
              },
              maxResults: 10,
            },
            expectation: { includeSnapshot: false },
          },
        ],
        globalExpectation: {
          includeDownloads: false,
          includeTabs: false,
        },
      },
    });

    expectBatchExecutionSuccess(result, 7);

    const text = result.content[0].text;

    // Verify nested structure discovery
    for (let i = 2; i <= 7; i++) {
      expect(text).toContain(`✅ Step ${i}: browser_find_elements`);
    }

    // Should find elements at various nesting levels
    const foundMatches =
      text.match(/Found \d+ elements matching the criteria/g) || [];
    expect(foundMatches.length).toBeGreaterThanOrEqual(6);
  });

  test('should handle data table with complex selectors', async ({
    client,
    server,
  }) => {
    setupTestPage(server, COMPLEX_HTML_TEMPLATES.TABLE_WITH_ACTIONS);

    const result = await client.callTool({
      name: 'browser_batch_execute',
      arguments: {
        steps: [
          {
            tool: 'browser_navigate',
            arguments: { url: server.PREFIX },
            expectation: { includeSnapshot: false },
          },
          // Find all table rows
          {
            tool: 'browser_find_elements',
            arguments: {
              searchCriteria: {
                tagName: 'tr',
                attributes: { 'data-row-id': '1' },
              },
              maxResults: 1,
            },
            expectation: { includeSnapshot: false },
          },
          // Find all checkboxes
          {
            tool: 'browser_find_elements',
            arguments: {
              searchCriteria: {
                tagName: 'input',
                attributes: { type: 'checkbox' },
              },
              maxResults: 10,
            },
            expectation: { includeSnapshot: false },
          },
          // Find edit buttons
          {
            tool: 'browser_find_elements',
            arguments: {
              searchCriteria: {
                attributes: { class: 'btn-edit' },
              },
              maxResults: 10,
            },
            expectation: { includeSnapshot: false },
          },
          // Find delete buttons
          {
            tool: 'browser_find_elements',
            arguments: {
              searchCriteria: {
                attributes: { class: 'btn-delete' },
              },
              maxResults: 10,
            },
            expectation: { includeSnapshot: false },
          },
          // Find active status cells
          {
            tool: 'browser_find_elements',
            arguments: {
              searchCriteria: {
                attributes: { class: 'row-status active' },
              },
              maxResults: 10,
            },
            expectation: { includeSnapshot: false },
          },
          // Find pagination buttons
          {
            tool: 'browser_find_elements',
            arguments: {
              searchCriteria: {
                attributes: { class: 'page-btn' },
              },
              maxResults: 5,
            },
            expectation: { includeSnapshot: false },
          },
        ],
        globalExpectation: {
          includeDownloads: false,
          includeTabs: false,
        },
      },
    });

    expectBatchExecutionSuccess(result, 7);

    const text = result.content[0].text;

    // Verify table element discovery
    for (let i = 2; i <= 7; i++) {
      expect(text).toContain(`✅ Step ${i}: browser_find_elements`);
    }
  });

  test('should handle maximum complexity with 20+ find_elements operations', async ({
    client,
    server,
  }) => {
    setupTestPage(server, COMPLEX_HTML_TEMPLATES.E_COMMERCE_PRODUCT);

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
        globalExpectation: {
          includeDownloads: false,
          includeTabs: false,
        },
      },
    });

    expectBatchExecutionSuccess(result, 21);

    const text = result.content[0].text;

    // Verify all 20 find_elements operations succeeded
    for (let i = 2; i <= 21; i++) {
      expect(text).toContain(`✅ Step ${i}: browser_find_elements`);
    }

    // Verify performance is reasonable even with many operations
    const TIME_REGEX = /Total Time: (\d+)ms/;
    const timeMatch = text.match(TIME_REGEX);
    if (timeMatch) {
      const totalTime = Number.parseInt(timeMatch[1], 10);
      expect(totalTime).toBeLessThan(10_000); // Should complete in under 10 seconds
    }
  });

  test('should handle mixed operations with find_elements maintaining ref consistency', async ({
    client,
    server,
  }) => {
    setupTestPage(server, COMPLEX_HTML_TEMPLATES.DYNAMIC_FORM_WIZARD);

    const result = await client.callTool({
      name: 'browser_batch_execute',
      arguments: {
        steps: [
          {
            tool: 'browser_navigate',
            arguments: { url: server.PREFIX },
            expectation: { includeSnapshot: false },
          },
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
            expectation: { includeSnapshot: false },
          },
          // Take a screenshot
          {
            tool: 'browser_take_screenshot',
            arguments: { filename: 'form-step1.png' },
            expectation: { includeSnapshot: false },
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
            expectation: { includeSnapshot: false },
          },
          // Evaluate some JavaScript
          {
            tool: 'browser_evaluate',
            arguments: {
              function: '() => document.querySelectorAll("input").length',
            },
            expectation: { includeSnapshot: false },
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
            expectation: { includeSnapshot: false },
          },
          // Wait a bit
          {
            tool: 'browser_wait_for',
            arguments: { time: 0.5 },
            expectation: { includeSnapshot: false },
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
            expectation: { includeSnapshot: false },
          },
          // Get final snapshot
          {
            tool: 'browser_snapshot',
            arguments: {},
            expectation: { includeSnapshot: true },
          },
        ],
        globalExpectation: {
          includeDownloads: false,
          includeTabs: false,
        },
      },
    });

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
    // Check that we found elements in steps 2, 4, 6, 8
    const foundMatches =
      text.match(/Found \d+ elements matching the criteria/g) || [];
    expect(foundMatches.length).toBeGreaterThanOrEqual(4);
  });

  test('should handle error recovery with find_elements operations', async ({
    client,
    server,
  }) => {
    setupTestPage(server, COMPLEX_HTML_TEMPLATES.E_COMMERCE_PRODUCT);

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
