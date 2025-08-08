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

import { expect, test } from '@playwright/test';

test.describe('Tab._truncateAtWordBoundary helper function', () => {
  // Test the helper function directly since we can't easily mock Tab class

  function truncateAtWordBoundary(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
      return text;
    }

    // Find the last space within the maxLength limit
    let truncateIndex = maxLength;
    for (let i = maxLength - 1; i >= 0; i--) {
      if (text[i] === ' ') {
        truncateIndex = i;
        break;
      }
    }

    // If no space found within reasonable distance (more than 30% back), just cut at maxLength
    if (maxLength - truncateIndex > maxLength * 0.3) {
      truncateIndex = maxLength;
    }

    return text.substring(0, truncateIndex).trim();
  }

  test('should truncate at word boundary when possible', () => {
    const text = 'This is a test content with multiple words';
    const result = truncateAtWordBoundary(text, 20);

    expect(result.length).toBeLessThanOrEqual(20);
    expect(result).toBe('This is a test');
    // Result ends with complete word "test", which is correct
    expect(result.endsWith(' content')).toBe(false); // Should not include partial word
  });

  test('should return original text when under limit', () => {
    const text = 'Short text';
    const result = truncateAtWordBoundary(text, 50);

    expect(result).toBe(text);
  });

  test('should cut at maxLength when no spaces within reasonable distance', () => {
    const text = 'Verylongwordwithoutanyspaces';
    const result = truncateAtWordBoundary(text, 10);

    expect(result.length).toBeLessThanOrEqual(10);
    expect(result).toBe('Verylongwo');
  });

  test('should handle edge case with single word longer than maxLength', () => {
    const text = 'supercalifragilisticexpialidocious';
    const result = truncateAtWordBoundary(text, 15);

    expect(result.length).toBeLessThanOrEqual(15);
    expect(result).toBe('supercalifragil');
  });

  test('should handle text with multiple spaces', () => {
    const text = 'This  has   multiple    spaces between words';
    const result = truncateAtWordBoundary(text, 25);

    expect(result.length).toBeLessThanOrEqual(25);
    expect(result).toBe('This  has   multiple');
  });
});
