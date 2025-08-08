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

test.describe('Sharp Implementation Performance Tests', () => {
  // Use real test image from extension icons (128x128 PNG)
  function createLargerTestImageBuffer(): Buffer {
    const imagePath = join(process.cwd(), 'extension/icons/icon-128.png');
    return readFileSync(imagePath);
  }

  test('should handle large image processing efficiently', async () => {
    const { processImage } = await import('../src/utils/imageProcessor.js');
    const testBuffer = createLargerTestImageBuffer();

    const startTime = performance.now();
    const startMemory = process.memoryUsage().heapUsed;

    // Process with multiple operations
    const operations = [
      { maxWidth: 800, maxHeight: 600, quality: 90, format: 'jpeg' as const },
      { maxWidth: 400, maxHeight: 300, quality: 80, format: 'webp' as const },
      { maxWidth: 200, maxHeight: 150, quality: 70, format: 'png' as const },
    ];

    const results = await Promise.all(
      operations.map((options) =>
        processImage(testBuffer, 'image/png', options)
      )
    );

    const endTime = performance.now();
    const endMemory = process.memoryUsage().heapUsed;

    // Performance assertions
    const processingTime = endTime - startTime;
    const memoryIncrease = endMemory - startMemory;

    // console.log(`Processing time: ${processingTime.toFixed(2)}ms`);
    // console.log(`Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);

    // Reasonable performance expectations
    expect(processingTime).toBeLessThan(5000); // Should complete within 5 seconds
    expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // Should not increase memory by more than 50MB

    // Verify all results are valid
    for (const result of results) {
      expect(result.data).toBeInstanceOf(Buffer);
      expect(result.data.length).toBeGreaterThan(0);
      // Compression ratio can be > 1.0 when converting formats (e.g., PNG to JPEG)
      expect(result.compressionRatio).toBeGreaterThan(0);
      expect(result.processedSize.width).toBeGreaterThan(0);
      expect(result.processedSize.height).toBeGreaterThan(0);
    }
  });

  test('should not leak memory with multiple sequential operations', async () => {
    const { processImage } = await import('../src/utils/imageProcessor.js');
    const testBuffer = createLargerTestImageBuffer();

    const initialMemory = process.memoryUsage().heapUsed;

    // Perform multiple operations sequentially to test for memory leaks
    for (let i = 0; i < 10; i++) {
      // biome-ignore lint/nursery/noAwaitInLoop: Sequential execution required to test for memory leaks between operations
      await processImage(testBuffer, 'image/png', {
        maxWidth: 500,
        maxHeight: 500,
        quality: 85,
        format: 'jpeg',
      });

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
    }

    const finalMemory = process.memoryUsage().heapUsed;
    const memoryIncrease = finalMemory - initialMemory;

    // console.log(`Memory increase after 10 operations: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);

    // Should not accumulate significant memory
    expect(memoryIncrease).toBeLessThan(20 * 1024 * 1024); // Less than 20MB increase
  });

  test('should handle concurrent image processing', async () => {
    const { processImage } = await import('../src/utils/imageProcessor.js');
    const testBuffer = createLargerTestImageBuffer();

    const startTime = performance.now();

    // Process multiple images concurrently
    const promises = Array.from({ length: 5 }, (_, i) =>
      processImage(testBuffer, 'image/png', {
        maxWidth: 300 + i * 50,
        maxHeight: 300 + i * 50,
        quality: 80,
        format: 'jpeg',
      })
    );

    const results = await Promise.all(promises);
    const endTime = performance.now();

    const totalTime = endTime - startTime;
    // console.log(`Concurrent processing time: ${totalTime.toFixed(2)}ms`);

    // Should complete reasonably quickly
    expect(totalTime).toBeLessThan(10_000); // 10 seconds max

    // All results should be valid
    for (const [index, result] of results.entries()) {
      expect(result.data).toBeInstanceOf(Buffer);
      expect(result.contentType).toBe('image/jpeg');
      expect(result.processedSize.width).toBeLessThanOrEqual(300 + index * 50);
      expect(result.processedSize.height).toBeLessThanOrEqual(300 + index * 50);
    }
  });

  test('should handle error conditions gracefully', async () => {
    const { processImage } = await import('../src/utils/imageProcessor.js');

    // Test with invalid image data
    const invalidBuffer = Buffer.from('not an image');

    await expect(
      processImage(invalidBuffer, 'image/png', { quality: 80 })
    ).rejects.toThrow();
  });

  test('should preserve metadata when appropriate', async () => {
    const { processImage } = await import('../src/utils/imageProcessor.js');
    const testBuffer = createLargerTestImageBuffer();

    // Test preserving original format when no format specified
    const result = await processImage(testBuffer, 'image/png');

    expect(result.contentType).toBe('image/png');
    expect(result.compressionRatio).toBe(1.0);
    expect(result.data).toBe(testBuffer); // Should return original buffer unchanged
  });
});
