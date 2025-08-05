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

import { test, expect } from '@playwright/test';
import { readFileSync } from 'fs';
import { join } from 'path';

test.describe('Image Processing Utils', () => {
  // Use real test image from extension icons
  function createTestImageBuffer(): Buffer {
    const imagePath = join(process.cwd(), 'extension/icons/icon-48.png');
    return readFileSync(imagePath);
  }

  test('processImage module should exist now', async () => {
    // Now the module should exist
    const { processImage, validateImageOptions } = await import('../src/utils/imageProcessor.js');
    expect(typeof processImage).toBe('function');
    expect(typeof validateImageOptions).toBe('function');
  });

  test('should validate image quality bounds correctly', async () => {
    const { validateImageOptions } = await import('../src/utils/imageProcessor.js');

    const testCases = [
      { options: { quality: 0 }, shouldHaveErrors: true },
      { options: { quality: 101 }, shouldHaveErrors: true },
      { options: { quality: 50 }, shouldHaveErrors: false },
      { options: { quality: 1 }, shouldHaveErrors: false },
      { options: { quality: 100 }, shouldHaveErrors: false }
    ];

    for (const testCase of testCases) {
      const errors = validateImageOptions(testCase.options);
      if (testCase.shouldHaveErrors) {
        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0]).toContain('quality must be between 1 and 100');
      } else {
        expect(errors.length).toBe(0);
      }
    }
  });

  test('should validate image dimension bounds correctly', async () => {
    const { validateImageOptions } = await import('../src/utils/imageProcessor.js');

    const testCases = [
      { options: { maxWidth: 0 }, shouldHaveErrors: true },
      { options: { maxHeight: -1 }, shouldHaveErrors: true },
      { options: { maxWidth: 100 }, shouldHaveErrors: false },
      { options: { maxHeight: 100 }, shouldHaveErrors: false }
    ];

    for (const testCase of testCases) {
      const errors = validateImageOptions(testCase.options);
      if (testCase.shouldHaveErrors) {
        expect(errors.length).toBeGreaterThan(0);
        expect(errors.some(e => e.includes('must be greater than 0'))).toBe(true);
      } else {
        expect(errors.length).toBe(0);
      }
    }
  });

  test('should process image with quality option', async () => {
    const { processImage } = await import('../src/utils/imageProcessor.js');
    const testBuffer = createTestImageBuffer();
    const options = { quality: 80, format: 'jpeg' as const };

    const result = await processImage(testBuffer, 'image/png', options);

    expect(result.contentType).toBe('image/jpeg');
    expect(result.data).toBeInstanceOf(Buffer);
    expect(result.compressionRatio).toBeLessThanOrEqual(1.0);
    expect(result.originalSize.width).toBeGreaterThan(0);
    expect(result.originalSize.height).toBeGreaterThan(0);
  });

  test('should process image with size constraints', async () => {
    const { processImage } = await import('../src/utils/imageProcessor.js');
    const testBuffer = createTestImageBuffer();
    const options = { maxWidth: 50, maxHeight: 50 };

    const result = await processImage(testBuffer, 'image/png', options);

    expect(result.processedSize.width).toBeLessThanOrEqual(50);
    expect(result.processedSize.height).toBeLessThanOrEqual(50);
    expect(result.originalSize.width).toBeGreaterThan(0);
    expect(result.originalSize.height).toBeGreaterThan(0);
  });

  test('should handle different image formats', async () => {
    const { processImage } = await import('../src/utils/imageProcessor.js');
    const testBuffer = createTestImageBuffer();
    const formats = ['jpeg', 'png', 'webp'] as const;

    for (const format of formats) {
      const result = await processImage(testBuffer, 'image/png', { format });
      expect(result.contentType).toBe(`image/${format}`);
      expect(result.data).toBeInstanceOf(Buffer);
    }
  });

  test('should return original image when no options provided', async () => {
    const { processImage } = await import('../src/utils/imageProcessor.js');
    const testBuffer = createTestImageBuffer();

    const result = await processImage(testBuffer, 'image/png');

    expect(result.data).toBe(testBuffer);
    expect(result.contentType).toBe('image/png');
    expect(result.compressionRatio).toBe(1.0);
  });
});

