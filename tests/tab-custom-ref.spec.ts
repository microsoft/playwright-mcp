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

import { expect, test } from '@playwright/test';
import type * as playwright from 'playwright';
import { chromium } from 'playwright';
import { Tab } from '../src/tab.js';
import type { CustomRefOptions } from '../src/types/batch.js';

test.describe('Tab.getNextCustomRefId', () => {
  let tab: Tab;
  let browser: playwright.Browser;
  let context: playwright.BrowserContext;
  let page: playwright.Page;

  test.beforeEach(async () => {
    // Create a proper browser context for testing
    browser = await chromium.launch();
    context = await browser.newContext();
    page = await context.newPage();

    // Create mock context that provides required methods
    interface MockContext {
      log: {
        log: () => void;
        debug: () => void;
        error: () => void;
      };
    }
    const mockContext: MockContext = {
      log: {
        log: () => {
          /* no-op */
        },
        debug: () => {
          /* no-op */
        },
        error: () => {
          /* no-op */
        },
      },
    };

    const mockOnPageClose = () => {
      /* no-op */
    };
    tab = new Tab(mockContext, page, mockOnPageClose);
  });

  test.afterEach(async () => {
    if (page) {
      await page.close();
    }
    if (context) {
      await context.close();
    }
    if (browser) {
      await browser.close();
    }
  });

  test('should generate sequential ref IDs without options', () => {
    const ref1 = tab.getNextCustomRefId();
    const ref2 = tab.getNextCustomRefId();
    const ref3 = tab.getNextCustomRefId();

    expect(ref1).toBe('element_1');
    expect(ref2).toBe('element_2');
    expect(ref3).toBe('element_3');
  });

  test('should maintain backward compatibility with no arguments', () => {
    const ref1 = tab.getNextCustomRefId();
    const ref2 = tab.getNextCustomRefId();

    expect(ref1).toBe('element_1');
    expect(ref2).toBe('element_2');
  });

  test('should generate ref IDs without batch ID when options are empty', () => {
    const options: CustomRefOptions = {};
    const ref1 = tab.getNextCustomRefId(options);
    const ref2 = tab.getNextCustomRefId(options);

    expect(ref1).toBe('element_1');
    expect(ref2).toBe('element_2');
  });

  test('should generate batch-prefixed ref IDs when batch ID is provided', () => {
    const options: CustomRefOptions = { batchId: 'batch_123' };
    const ref1 = tab.getNextCustomRefId(options);
    const ref2 = tab.getNextCustomRefId(options);
    const ref3 = tab.getNextCustomRefId(options);

    expect(ref1).toBe('batch_batch_123_element_1');
    expect(ref2).toBe('batch_batch_123_element_2');
    expect(ref3).toBe('batch_batch_123_element_3');
  });

  test('should handle different batch IDs correctly', () => {
    const batch1Options: CustomRefOptions = { batchId: 'abc' };
    const batch2Options: CustomRefOptions = { batchId: '456' };

    const ref1 = tab.getNextCustomRefId(batch1Options);
    const ref2 = tab.getNextCustomRefId(batch2Options);
    const ref3 = tab.getNextCustomRefId(batch1Options);

    expect(ref1).toBe('batch_abc_element_1');
    expect(ref2).toBe('batch_456_element_2');
    expect(ref3).toBe('batch_abc_element_3');
  });

  test('should continue counter regardless of batch ID presence', () => {
    const ref1 = tab.getNextCustomRefId(); // No options
    const ref2 = tab.getNextCustomRefId({ batchId: 'test' });
    const ref3 = tab.getNextCustomRefId(); // No options again

    expect(ref1).toBe('element_1');
    expect(ref2).toBe('batch_test_element_2');
    expect(ref3).toBe('element_3');
  });

  test('should handle empty string batch ID as regular element', () => {
    const options: CustomRefOptions = { batchId: '' };
    const ref1 = tab.getNextCustomRefId(options);

    expect(ref1).toBe('element_1');
  });
});
