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

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';

// Move regex to top-level to avoid performance issues
const IMAGE_PROCESSING_FAILED_REGEX = /Image processing failed/;

test.describe('Sharp Error Handling Tests', () => {
  test('should throw errors for invalid image data', async () => {
    const { processImage } = await import('../lib/utils/image-processor.js');

    // Test with various invalid data - all should throw errors
    const testCases = [
      { data: Buffer.from('not an image'), description: 'text data' },
      {
        data: Buffer.from([0x00, 0x01, 0x02, 0x03]),
        description: 'random bytes',
      },
      { data: Buffer.alloc(0), description: 'empty buffer' },
      { data: Buffer.from('GIF89a'), description: 'partial GIF header' },
    ];

    // Use Promise.all to avoid await in loop
    await Promise.all(
      testCases.map((testCase) =>
        expect(
          processImage(testCase.data, 'image/png', { quality: 80 })
        ).rejects.toThrow(IMAGE_PROCESSING_FAILED_REGEX)
      )
    );
  });

  test('should handle valid PNG data with Sharp', async () => {
    const { processImage } = await import('../lib/utils/image-processor.js');

    // Use a real PNG file from the extension icons
    const pngPath = join(process.cwd(), 'extension/icons/icon-16.png');
    const pngBuffer = readFileSync(pngPath);

    const result = await processImage(pngBuffer, 'image/png', {
      quality: 90,
      format: 'jpeg',
    });

    // This should work with actual Sharp processing
    expect(result.contentType).toBe('image/jpeg');
    expect(result.data).toBeInstanceOf(Buffer);
    expect(result.originalSize.width).toBeGreaterThan(0);
    expect(result.originalSize.height).toBeGreaterThan(0);
  });

  test('should handle valid vs invalid image data correctly', async () => {
    const { processImage } = await import('../lib/utils/image-processor.js');

    // Test case that should work with Sharp processing - use real PNG
    const validPngPath = join(process.cwd(), 'extension/icons/icon-32.png');
    const validPng = readFileSync(validPngPath);

    // Test case that should throw error
    const invalidData = Buffer.from('not an image at all');

    // Valid PNG should process successfully
    const validResult = await processImage(validPng, 'image/png', {
      format: 'jpeg',
      quality: 80,
    });

    expect(validResult.contentType).toBe('image/jpeg');
    expect(validResult.originalSize.width).toBeGreaterThan(0);
    expect(validResult.originalSize.height).toBeGreaterThan(0);

    // Invalid data should throw error
    await expect(
      processImage(invalidData, 'image/png', { format: 'jpeg', quality: 80 })
    ).rejects.toThrow(IMAGE_PROCESSING_FAILED_REGEX);
  });
});
