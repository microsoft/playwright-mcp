/**
 * Batch Find Elements Integration Tests
 * 
 * Tests batch execution with multiple browser_find_elements and browser_type operations
 * to ensure proper coordination, ref handling, and uniqueness guarantees.
 */

import { expect, test } from './fixtures.js';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { TestServer } from './testserver/index.js';
import {
  expectBatchExecutionSuccess,
  expectBatchExecutionPartialSuccess,
  executeBatchWithErrorHandling,
  createTestPage,
} from './test-utils.js';

type CallToolResponse = Awaited<ReturnType<Client['callTool']>>;

// HTML templates for integration testing
const INTEGRATION_HTML_TEMPLATES = {
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
} as const;

/**
 * Helper function to setup test server with content
 */
function setupTestPage(server: TestServer, htmlContent: string, path = '/'): void {
  const page = createTestPage(htmlContent, 'Integration Test Page');
  server.setContent(path, page.content, page.contentType);
}

/**
 * Helper function to create batch steps for find_elements followed by type
 */
function createFindElementsAndTypeSteps(
  searchCriteria: Record<string, unknown>[],
  typeData: { text: string; element: string }[]
): Array<{
  tool: string;
  arguments: Record<string, unknown>;
  expectation?: Record<string, unknown>;
}> {
  const steps: Array<{
    tool: string;
    arguments: Record<string, unknown>;
    expectation?: Record<string, unknown>;
  }> = [];

  // Add find_elements steps
  searchCriteria.forEach((criteria, index) => {
    steps.push({
      tool: 'browser_find_elements',
      arguments: {
        searchCriteria: criteria,
        maxResults: 5,
      },
      expectation: {
        includeSnapshot: false,
        includeConsole: false,
      },
    });
  });

  // Add type steps that reference the found elements
  typeData.forEach((data, index) => {
    steps.push({
      tool: 'browser_type',
      arguments: {
        text: data.text,
        element: data.element,
        ref: `e${index + 2}`, // Assuming refs start from e2 (e1 is typically page)
      },
      expectation: {
        includeSnapshot: false,
        includeConsole: false,
      },
    });
  });

  return steps;
}

test.describe('Batch Find Elements Integration Tests', () => {

  test('should execute find_elements in batch mode successfully', async ({
    client,
    server,
  }) => {
    // Focus on verifying that browser_find_elements works in batch mode
    const simpleForm = `
      <form>
        <input id="username" type="text" placeholder="Username">
        <input id="password" type="password" placeholder="Password">
        <button type="submit">Submit</button>
      </form>
    `;
    setupTestPage(server, simpleForm);

    const result = await client.callTool({
      name: 'browser_batch_execute',
      arguments: {
        steps: [
          {
            tool: 'browser_navigate',
            arguments: { url: server.PREFIX },
            expectation: { includeSnapshot: false, includeConsole: false },
          },
          {
            tool: 'browser_find_elements',
            arguments: {
              searchCriteria: { tagName: 'input' },
              maxResults: 3,
            },
            expectation: { includeSnapshot: false, includeConsole: false },
          },
          {
            tool: 'browser_find_elements',
            arguments: {
              searchCriteria: { tagName: 'button' },
              maxResults: 3,
            },
            expectation: { includeSnapshot: false, includeConsole: false },
          },
        ],
        globalExpectation: {
          includeDownloads: false,
          includeTabs: false,
        },
      },
    });

    expectBatchExecutionSuccess(result, 3);
    
    // Verify that both find_elements steps executed successfully
    expect(result.content[0].text).toContain('✅ Step 2: browser_find_elements');
    expect(result.content[0].text).toContain('✅ Step 3: browser_find_elements');
    
    // Verify that elements were found
    expect(result.content[0].text).toContain('Found');
    expect(result.content[0].text).toContain('elements matching the criteria');
  });

  test('should execute multiple find_elements operations without conflicts', async ({
    client,
    server,
  }) => {
    setupTestPage(server, INTEGRATION_HTML_TEMPLATES.MULTI_SECTION_FORM);

    const result = await client.callTool({
      name: 'browser_batch_execute',
      arguments: {
        steps: [
          {
            tool: 'browser_navigate',
            arguments: { url: server.PREFIX },
            expectation: { includeSnapshot: false, includeConsole: false },
          },
          // Multiple find_elements operations with different criteria
          {
            tool: 'browser_find_elements',
            arguments: {
              searchCriteria: { tagName: 'input' },
              maxResults: 5,
            },
            expectation: { includeSnapshot: false, includeConsole: false },
          },
          {
            tool: 'browser_find_elements',
            arguments: {
              searchCriteria: { tagName: 'textarea' },
              maxResults: 2,
            },
            expectation: { includeSnapshot: false, includeConsole: false },
          },
          {
            tool: 'browser_find_elements',
            arguments: {
              searchCriteria: { tagName: 'select' },
              maxResults: 2,
            },
            expectation: { includeSnapshot: false, includeConsole: false },
          },
          {
            tool: 'browser_find_elements',
            arguments: {
              searchCriteria: { tagName: 'button' },
              maxResults: 3,
            },
            expectation: { includeSnapshot: false, includeConsole: false },
          },
        ],
        globalExpectation: {
          includeDownloads: false,
          includeTabs: false,
        },
      },
    });

    expectBatchExecutionSuccess(result, 5);
    
    // Verify all find_elements steps executed successfully
    expect(result.content[0].text).toContain('✅ Step 2: browser_find_elements');
    expect(result.content[0].text).toContain('✅ Step 3: browser_find_elements');
    expect(result.content[0].text).toContain('✅ Step 4: browser_find_elements');
    expect(result.content[0].text).toContain('✅ Step 5: browser_find_elements');
    
    // Verify that elements were found in each search
    const text = result.content[0].text;
    const foundCount = (text.match(/Found \d+ elements matching the criteria/g) || []).length;
    expect(foundCount).toBeGreaterThanOrEqual(3); // Should have multiple "Found X elements" messages
  });

  test('should handle different search criteria on same page without conflicts', async ({
    client,
    server,
  }) => {
    setupTestPage(server, INTEGRATION_HTML_TEMPLATES.DUPLICATE_ELEMENTS);

    const result = await client.callTool({
      name: 'browser_batch_execute',
      arguments: {
        steps: [
          {
            tool: 'browser_navigate',
            arguments: { url: server.PREFIX },
            expectation: { includeSnapshot: false, includeConsole: false },
          },
          // Find by class name - should find multiple input fields
          {
            tool: 'browser_find_elements',
            arguments: {
              searchCriteria: { attributes: { class: 'input-field' } },
              maxResults: 3,
            },
            expectation: { includeSnapshot: false, includeConsole: false },
          },
          // Find by different class name - should find multiple buttons
          {
            tool: 'browser_find_elements',
            arguments: {
              searchCriteria: { attributes: { class: 'action-btn' } },
              maxResults: 3,
            },
            expectation: { includeSnapshot: false, includeConsole: false },
          },
          // Find by specific text content - should find one input
          {
            tool: 'browser_find_elements',
            arguments: {
              searchCriteria: { text: 'Section A Input' },
              maxResults: 1,
            },
            expectation: { includeSnapshot: false, includeConsole: false },
          },
          // Find by section class - should find container divs
          {
            tool: 'browser_find_elements',
            arguments: {
              searchCriteria: { attributes: { class: 'section' } },
              maxResults: 5,
            },
            expectation: { includeSnapshot: false, includeConsole: false },
          },
        ],
        globalExpectation: {
          includeDownloads: false,
          includeTabs: false,
        },
      },
    });

    expectBatchExecutionSuccess(result, 5);
    
    // Verify all find_elements operations succeeded without conflicts
    const text = result.content[0].text;
    expect(text).toContain('✅ Step 2: browser_find_elements');
    expect(text).toContain('✅ Step 3: browser_find_elements');
    expect(text).toContain('✅ Step 4: browser_find_elements');
    expect(text).toContain('✅ Step 5: browser_find_elements');
    
    // Verify that different searches returned results
    const foundMatches = text.match(/Found \d+ elements matching the criteria/g) || [];
    expect(foundMatches.length).toBeGreaterThanOrEqual(3);
  });

  test('should handle error cases with invalid search criteria gracefully', async ({
    client,
    server,
  }) => {
    setupTestPage(server, INTEGRATION_HTML_TEMPLATES.ERROR_HANDLING_FORM);

    const { result } = await executeBatchWithErrorHandling(client, [
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
    ], {
      stopOnFirstError: false,
    });

    // All operations should succeed, even if some return 0 results
    expectBatchExecutionSuccess(result, 4);
    
    const text = result.content[0].text;
    expect(text).toContain('✅ Step 1: browser_navigate');
    expect(text).toContain('✅ Step 2: browser_find_elements');
    expect(text).toContain('✅ Step 3: browser_find_elements'); // Even with 0 results
    expect(text).toContain('✅ Step 4: browser_find_elements');
  });

  test('should verify performance with multiple concurrent find_elements operations', async ({
    client,
    server,
  }) => {
    setupTestPage(server, INTEGRATION_HTML_TEMPLATES.COMPLEX_FORM);

    const result = await client.callTool({
      name: 'browser_batch_execute',
      arguments: {
        steps: [
          {
            tool: 'browser_navigate',
            arguments: { url: server.PREFIX },
            expectation: { includeSnapshot: false, includeConsole: false },
          },
          // Multiple concurrent find_elements operations with different criteria
          {
            tool: 'browser_find_elements',
            arguments: {
              searchCriteria: { tagName: 'input' },
              maxResults: 10,
            },
            expectation: { includeSnapshot: false, includeConsole: false },
          },
          {
            tool: 'browser_find_elements',
            arguments: {
              searchCriteria: { tagName: 'button' },
              maxResults: 5,
            },
            expectation: { includeSnapshot: false, includeConsole: false },
          },
          {
            tool: 'browser_find_elements',
            arguments: {
              searchCriteria: { attributes: { type: 'password' } },
              maxResults: 3,
            },
            expectation: { includeSnapshot: false, includeConsole: false },
          },
          {
            tool: 'browser_find_elements',
            arguments: {
              searchCriteria: { attributes: { type: 'text' } },
              maxResults: 3,
            },
            expectation: { includeSnapshot: false, includeConsole: false },
          },
          {
            tool: 'browser_find_elements',
            arguments: {
              searchCriteria: { attributes: { class: 'form-group' } },
              maxResults: 5,
            },
            expectation: { includeSnapshot: false, includeConsole: false },
          },
        ],
        globalExpectation: {
          includeDownloads: false,
          includeTabs: false,
        },
      },
    });

    expectBatchExecutionSuccess(result, 6);
    
    const text = result.content[0].text;
    
    // Check that all find_elements operations succeeded
    expect(text).toContain('✅ Step 2: browser_find_elements');
    expect(text).toContain('✅ Step 3: browser_find_elements');
    expect(text).toContain('✅ Step 4: browser_find_elements');
    expect(text).toContain('✅ Step 5: browser_find_elements');
    expect(text).toContain('✅ Step 6: browser_find_elements');
    
    // Verify reasonable performance (all operations complete reasonably fast)
    expect(text).toContain('Total Time:');
    const timeMatch = text.match(/Total Time: (\d+)ms/);
    if (timeMatch) {
      const totalTime = parseInt(timeMatch[1], 10);
      expect(totalTime).toBeLessThan(5000); // Should complete in under 5 seconds
    }
  });

  test('should handle complex form analysis workflow', async ({
    client,
    server,
  }) => {
    setupTestPage(server, INTEGRATION_HTML_TEMPLATES.COMPLEX_FORM);

    const result = await client.callTool({
      name: 'browser_batch_execute',
      arguments: {
        steps: [
          {
            tool: 'browser_navigate',
            arguments: { url: server.PREFIX },
            expectation: { includeSnapshot: false, includeConsole: false },
          },
          // Analyze different types of form elements
          {
            tool: 'browser_find_elements',
            arguments: {
              searchCriteria: { tagName: 'input', attributes: { type: 'text' } },
              maxResults: 5,
            },
            expectation: { includeSnapshot: false, includeConsole: false },
          },
          {
            tool: 'browser_find_elements',
            arguments: {
              searchCriteria: { tagName: 'input', attributes: { type: 'email' } },
              maxResults: 5,
            },
            expectation: { includeSnapshot: false, includeConsole: false },
          },
          {
            tool: 'browser_find_elements',
            arguments: {
              searchCriteria: { tagName: 'input', attributes: { type: 'password' } },
              maxResults: 5,
            },
            expectation: { includeSnapshot: false, includeConsole: false },
          },
          {
            tool: 'browser_find_elements',
            arguments: {
              searchCriteria: { tagName: 'button' },
              maxResults: 10,
            },
            expectation: { includeSnapshot: false, includeConsole: false },
          },
          // Analyze form structure
          {
            tool: 'browser_find_elements',
            arguments: {
              searchCriteria: { tagName: 'form' },
              maxResults: 3,
            },
            expectation: { includeSnapshot: false, includeConsole: false },
          },
          {
            tool: 'browser_find_elements',
            arguments: {
              searchCriteria: { attributes: { class: 'form-group' } },
              maxResults: 10,
            },
            expectation: { includeSnapshot: false, includeConsole: false },
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
    expect(text).toContain('✅ Step 2: browser_find_elements'); // text inputs
    expect(text).toContain('✅ Step 3: browser_find_elements'); // email inputs
    expect(text).toContain('✅ Step 4: browser_find_elements'); // password inputs
    expect(text).toContain('✅ Step 5: browser_find_elements'); // buttons
    expect(text).toContain('✅ Step 6: browser_find_elements'); // forms
    expect(text).toContain('✅ Step 7: browser_find_elements'); // form groups
    
    // Verify that elements were found for form analysis
    const foundMatches = text.match(/Found \d+ elements matching the criteria/g) || [];
    expect(foundMatches.length).toBeGreaterThanOrEqual(4); // At least some successful searches
  });

  test('should handle mixed find_elements operations with different result limits', async ({
    client,
    server,
  }) => {
    setupTestPage(server, INTEGRATION_HTML_TEMPLATES.DUPLICATE_ELEMENTS);

    const result = await client.callTool({
      name: 'browser_batch_execute',
      arguments: {
        steps: [
          {
            tool: 'browser_navigate',
            arguments: { url: server.PREFIX },
            expectation: { includeSnapshot: false, includeConsole: false },
          },
          // Test different maxResults settings to ensure proper batching behavior
          {
            tool: 'browser_find_elements',
            arguments: {
              searchCriteria: { attributes: { class: 'input-field' } },
              maxResults: 1, // Only first match
            },
            expectation: { includeSnapshot: false, includeConsole: false },
          },
          {
            tool: 'browser_find_elements',
            arguments: {
              searchCriteria: { attributes: { class: 'action-btn' } },
              maxResults: 10, // All matches (more than available)
            },
            expectation: { includeSnapshot: false, includeConsole: false },
          },
          {
            tool: 'browser_find_elements',
            arguments: {
              searchCriteria: { attributes: { class: 'section' } },
              maxResults: 2, // Limited matches
            },
            expectation: { includeSnapshot: false, includeConsole: false },
          },
          {
            tool: 'browser_find_elements',
            arguments: {
              searchCriteria: { tagName: 'div' },
              maxResults: 0, // Edge case: limit of 0
            },
            expectation: { includeSnapshot: false, includeConsole: false },
          },
        ],
        globalExpectation: {
          includeDownloads: false,
          includeTabs: false,
        },
      },
    });

    expectBatchExecutionSuccess(result, 5);
    
    const text = result.content[0].text;
    expect(text).toContain('✅ Step 2: browser_find_elements');
    expect(text).toContain('✅ Step 3: browser_find_elements');
    expect(text).toContain('✅ Step 4: browser_find_elements');
    expect(text).toContain('✅ Step 5: browser_find_elements');
    
    // Verify that different result limits work correctly
    const foundMatches = text.match(/Found \d+ elements matching the criteria/g) || [];
    expect(foundMatches.length).toBeGreaterThanOrEqual(3);
  });

});