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

test.describe('Sharp Implementation Performance Tests', () => {
  // Create a realistic test image buffer (100x100 RGB PNG)
  function createLargerTestImageBuffer(): Buffer {
    // PNG signature
    const signature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
    
    // IHDR chunk for 100x100 image
    const ihdr = Buffer.concat([
      Buffer.from([0x00, 0x00, 0x00, 0x0D]), // Length
      Buffer.from('IHDR'),                    // Type
      Buffer.from([0x00, 0x00, 0x00, 0x64]), // Width: 100
      Buffer.from([0x00, 0x00, 0x00, 0x64]), // Height: 100
      Buffer.from([0x08, 0x02, 0x00, 0x00, 0x00]), // 8-bit RGB
      Buffer.from([0x7D, 0x7A, 0xEA, 0x8C])  // CRC
    ]);
    
    // Simple IDAT chunk with compressed data
    const idat = Buffer.concat([
      Buffer.from([0x00, 0x00, 0x00, 0x16]), // Length
      Buffer.from('IDAT'),                    // Type
      // Minimal deflate compressed data for testing
      Buffer.from([0x08, 0x1D, 0x01, 0x02, 0x00, 0xFD, 0xFF, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01]),
      Buffer.from([0x95, 0x05, 0xEF, 0x8C])  // CRC
    ]);
    
    // IEND chunk
    const iend = Buffer.concat([
      Buffer.from([0x00, 0x00, 0x00, 0x00]), // Length
      Buffer.from('IEND'),                    // Type
      Buffer.from([0xAE, 0x42, 0x60, 0x82])  // CRC
    ]);
    
    return Buffer.concat([signature, ihdr, idat, iend]);
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
      { maxWidth: 200, maxHeight: 150, quality: 70, format: 'png' as const }
    ];
    
    const results = [];
    for (const options of operations) {
      const result = await processImage(testBuffer, 'image/png', options);
      results.push(result);
    }
    
    const endTime = performance.now();
    const endMemory = process.memoryUsage().heapUsed;
    
    // Performance assertions
    const processingTime = endTime - startTime;
    const memoryIncrease = endMemory - startMemory;
    
    console.log(`Processing time: ${processingTime.toFixed(2)}ms`);
    console.log(`Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
    
    // Reasonable performance expectations
    expect(processingTime).toBeLessThan(5000); // Should complete within 5 seconds
    expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // Should not increase memory by more than 50MB
    
    // Verify all results are valid
    for (const result of results) {
      expect(result.data).toBeInstanceOf(Buffer);
      expect(result.data.length).toBeGreaterThan(0);
      expect(result.compressionRatio).toBeLessThanOrEqual(1.0);
      expect(result.processedSize.width).toBeGreaterThan(0);
      expect(result.processedSize.height).toBeGreaterThan(0);
    }
  });

  test('should not leak memory with multiple sequential operations', async () => {
    const { processImage } = await import('../src/utils/imageProcessor.js');
    const testBuffer = createLargerTestImageBuffer();
    
    const initialMemory = process.memoryUsage().heapUsed;
    
    // Perform multiple operations sequentially
    for (let i = 0; i < 10; i++) {
      await processImage(testBuffer, 'image/png', {
        maxWidth: 500,
        maxHeight: 500,
        quality: 85,
        format: 'jpeg'
      });
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
    }
    
    const finalMemory = process.memoryUsage().heapUsed;
    const memoryIncrease = finalMemory - initialMemory;
    
    console.log(`Memory increase after 10 operations: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
    
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
        format: 'jpeg'
      })
    );
    
    const results = await Promise.all(promises);
    const endTime = performance.now();
    
    const totalTime = endTime - startTime;
    console.log(`Concurrent processing time: ${totalTime.toFixed(2)}ms`);
    
    // Should complete reasonably quickly
    expect(totalTime).toBeLessThan(10000); // 10 seconds max
    
    // All results should be valid
    results.forEach((result, index) => {
      expect(result.data).toBeInstanceOf(Buffer);
      expect(result.contentType).toBe('image/jpeg');
      expect(result.processedSize.width).toBeLessThanOrEqual(300 + index * 50);
      expect(result.processedSize.height).toBeLessThanOrEqual(300 + index * 50);
    });
  });

  test('should handle error conditions gracefully', async () => {
    const { processImage } = await import('../src/utils/imageProcessor.js');
    
    // Test with invalid image data
    const invalidBuffer = Buffer.from('not an image');
    
    await expect(processImage(invalidBuffer, 'image/png', { quality: 80 }))
      .rejects.toThrow();
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