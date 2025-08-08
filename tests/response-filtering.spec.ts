/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { Response } from '../src/response.js';
import type { ExpectationOptions } from '../src/schemas/expectation.js';
import { expect, test } from './fixtures.js';

test.describe('Response Filtering', () => {
  // Create a mock context for testing Response class directly
  function createMockContext() {
    const mockTab = {
      captureSnapshot: async () => ({
        url: 'https://example.com',
        title: 'Test Page',
        ariaSnapshot: 'button "Click me" [ref=btn1]',
        consoleMessages: [
          { toString: () => 'console.log("test")', type: 'log' },
          { toString: () => 'console.error("error")', type: 'error' },
        ],
        downloads: [],
        modalStates: [],
      }),
      updateTitle: async () => {},
      isCurrentTab: () => true,
      lastTitle: () => 'Test Page',
      page: {
        url: () => 'https://example.com',
      },
    };

    return {
      currentTab: () => mockTab,
      currentTabOrDie: () => mockTab,
      tabs: () => [mockTab],
      config: {
        imageResponses: 'allow' as const,
      },
    };
  }

  test('should include all content when explicitly requested', async () => {
    const mockContext = createMockContext();
    const expectation: ExpectationOptions = {
      includeCode: true,
      includeSnapshot: true,
      includeTabs: true,
    };
    const response = new Response(
      mockContext as any,
      'navigate',
      { url: 'test' },
      expectation
    );
    response.addResult('Navigation successful');
    response.addCode('page.goto("test")');
    response.setIncludeSnapshot();
    response.setIncludeTabs();

    await response.finish();
    const serialized = response.serialize();

    expect(serialized.content[0].text).toContain('### Result');
    expect(serialized.content[0].text).toContain('Navigation successful');
    expect(serialized.content[0].text).toContain('### Ran Playwright code');
    expect(serialized.content[0].text).toContain('page.goto("test")');
    expect(serialized.content[0].text).toContain('### Page state');
  });

  test('should exclude snapshot when expectation.includeSnapshot is false', async () => {
    const mockContext = createMockContext();
    const expectation: ExpectationOptions = {
      includeSnapshot: false,
      includeConsole: true,
      includeDownloads: true,
      includeTabs: true,
      includeCode: true,
    };

    const response = new Response(
      mockContext as any,
      'click',
      { element: 'button' },
      expectation
    );
    response.addResult('Click successful');
    response.addCode('page.click("button")');

    await response.finish();
    const serialized = response.serialize();

    expect(serialized.content[0].text).toContain('### Result');
    expect(serialized.content[0].text).toContain('Click successful');
    expect(serialized.content[0].text).toContain('### Ran Playwright code');
    expect(serialized.content[0].text).not.toContain('### Page state');
  });

  test('should exclude code when expectation.includeCode is false', async () => {
    const mockContext = createMockContext();
    const expectation: ExpectationOptions = {
      includeSnapshot: true,
      includeConsole: true,
      includeDownloads: true,
      includeTabs: true,
      includeCode: false,
    };

    const response = new Response(
      mockContext as any,
      'click',
      { element: 'button' },
      expectation
    );
    response.addResult('Click successful');
    response.addCode('page.click("button")');
    response.setIncludeSnapshot();

    await response.finish();
    const serialized = response.serialize();

    expect(serialized.content[0].text).toContain('### Result');
    expect(serialized.content[0].text).toContain('Click successful');
    expect(serialized.content[0].text).not.toContain('### Ran Playwright code');
    expect(serialized.content[0].text).not.toContain('page.click("button")');
    expect(serialized.content[0].text).toContain('### Page state');
  });

  test('should exclude tabs when expectation.includeTabs is false', async () => {
    const mockContext = createMockContext();
    const expectation: ExpectationOptions = {
      includeSnapshot: true,
      includeConsole: true,
      includeDownloads: true,
      includeTabs: false,
      includeCode: true,
    };

    const response = new Response(
      mockContext as any,
      'navigate',
      { url: 'test' },
      expectation
    );
    response.addResult('Navigation successful');
    response.setIncludeSnapshot();

    await response.finish();
    const serialized = response.serialize();

    expect(serialized.content[0].text).toContain('### Result');
    expect(serialized.content[0].text).not.toContain('### Open tabs');
    expect(serialized.content[0].text).toContain('### Page state');
  });

  test('should use tool-specific defaults when no expectation provided', async () => {
    const mockContext = createMockContext();
    // Screenshot tool should have minimal output by default
    const response = new Response(
      mockContext as any,
      'browser_take_screenshot',
      {}
    );
    response.addResult('Screenshot taken');
    response.addCode('page.screenshot()');

    await response.finish();
    const serialized = response.serialize();

    // Should have result but no code, tabs, or snapshot
    expect(serialized.content[0].text).toContain('### Result');
    expect(serialized.content[0].text).toContain('Screenshot taken');
    expect(serialized.content[0].text).not.toContain('### Ran Playwright code');
    expect(serialized.content[0].text).not.toContain('### Open tabs');
    expect(serialized.content[0].text).not.toContain('### Page state');
  });

  test('should merge user expectation with tool defaults', async () => {
    const mockContext = createMockContext();
    // Token optimization: all defaults are now false
    // User overrides includeCode=true but doesn't specify others
    const expectation: ExpectationOptions = {
      includeCode: true,
    };

    const response = new Response(
      mockContext as any,
      'click',
      { element: 'button' },
      expectation
    );
    response.addResult('Click successful');
    response.addCode('page.click("button")');

    await response.finish();
    const serialized = response.serialize();

    // Should use default includeSnapshot=false
    expect(serialized.content[0].text).not.toContain('### Page state');

    // Should respect user's includeCode=true
    expect(serialized.content[0].text).toContain('### Ran Playwright code');
  });

  test('should handle console filtering options', async () => {
    const mockContext = createMockContext();
    // This test would need a page with console messages to be fully effective
    // For now, we test the expectation is properly stored
    const expectation: ExpectationOptions = {
      includeConsole: true,
      consoleOptions: {
        levels: ['error', 'warn'],
        maxMessages: 3,
      },
    };

    const response = new Response(
      mockContext as any,
      'evaluate',
      { code: 'console.log("test")' },
      expectation
    );

    // Test that expectation is stored correctly
    expect(response._expectation?.includeConsole).toBe(true);
    expect(response._expectation?.consoleOptions?.levels).toEqual([
      'error',
      'warn',
    ]);
    expect(response._expectation?.consoleOptions?.maxMessages).toBe(3);
  });

  test('should handle snapshot filtering options', async () => {
    const mockContext = createMockContext();
    const expectation: ExpectationOptions = {
      includeSnapshot: true,
      snapshotOptions: {
        selector: '.content',
        maxLength: 500,
        format: 'text',
      },
    };

    const response = new Response(
      mockContext as any,
      'navigate',
      { url: 'test' },
      expectation
    );

    // Test that expectation is stored correctly
    expect(response._expectation?.includeSnapshot).toBe(true);
    expect(response._expectation?.snapshotOptions?.selector).toBe('.content');
    expect(response._expectation?.snapshotOptions?.maxLength).toBe(500);
    expect(response._expectation?.snapshotOptions?.format).toBe('text');
  });
});
