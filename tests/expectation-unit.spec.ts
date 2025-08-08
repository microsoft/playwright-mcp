// @ts-nocheck
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

import { mergeExpectations } from '../src/schemas/expectation.js';
import { expect, test } from './fixtures.js';

test.describe('Expectation Unit Tests', () => {
  test('mergeExpectations should respect user false values', () => {
    const userExpectation = {
      includeSnapshot: false,
      includeConsole: false,
      includeDownloads: false,
      includeTabs: false,
      includeCode: true,
    };

    const merged = mergeExpectations('browser_navigate', userExpectation);

    expect(merged.includeSnapshot).toBe(false);
    expect(merged.includeConsole).toBe(false);
    expect(merged.includeDownloads).toBe(false);
    expect(merged.includeTabs).toBe(false);
    expect(merged.includeCode).toBe(true);
  });

  test('mergeExpectations should use tool defaults when user expectation is undefined', () => {
    const merged = mergeExpectations('browser_navigate', undefined);

    // Navigate tool defaults should be all false (token optimization)
    expect(merged.includeSnapshot).toBe(false);
    expect(merged.includeConsole).toBe(false);
    expect(merged.includeDownloads).toBe(false);
    expect(merged.includeTabs).toBe(false);
    expect(merged.includeCode).toBe(false);
  });

  test('mergeExpectations should use tool defaults for click tool', () => {
    const merged = mergeExpectations('browser_click', undefined);

    // Click tool defaults (all false for token optimization)
    expect(merged.includeSnapshot).toBe(false);
    expect(merged.includeConsole).toBe(false);
    expect(merged.includeDownloads).toBe(false);
    expect(merged.includeTabs).toBe(false);
    expect(merged.includeCode).toBe(false);
  });

  test('mergeExpectations should partially override tool defaults', () => {
    const userExpectation = {
      includeSnapshot: true, // Changed to true since default is now false
      // Other values should use tool defaults
    };

    const merged = mergeExpectations('browser_click', userExpectation);

    expect(merged.includeSnapshot).toBe(true); // User override
    expect(merged.includeConsole).toBe(false); // Tool default
    expect(merged.includeDownloads).toBe(false); // Tool default
    expect(merged.includeTabs).toBe(false); // Tool default
    expect(merged.includeCode).toBe(false); // Tool default (now false)
  });
});
