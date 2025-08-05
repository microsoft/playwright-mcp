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

test.describe('Sharp Error Handling Tests', () => {
  test('should throw errors for invalid image data', async () => {
    const { processImage } = await import('../src/utils/imageProcessor.js');
    
    // Test with various invalid data - all should throw errors
    const testCases = [
      { data: Buffer.from('not an image'), description: 'text data' },
      { data: Buffer.from([0x00, 0x01, 0x02, 0x03]), description: 'random bytes' },
      { data: Buffer.alloc(0), description: 'empty buffer' },
      { data: Buffer.from('GIF89a'), description: 'partial GIF header' }
    ];
    
    for (const testCase of testCases) {
      console.log(`Testing with ${testCase.description}:`);
      
      // Should throw error for invalid image data
      await expect(processImage(testCase.data, 'image/png', { quality: 80 }))
        .rejects.toThrow(/Image processing failed/);
    }
  });

  test('should handle valid PNG data with Sharp', async () => {
    const { processImage } = await import('../src/utils/imageProcessor.js');
    
    // Create a minimal valid PNG
    const pngBuffer = Buffer.from([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,  // PNG signature
      0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,  // IHDR chunk header
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,  // 1x1 dimensions
      0x01, 0x00, 0x00, 0x00, 0x00, 0x37, 0x6E, 0xF9,  // 1-bit grayscale
      0x24, 0x00, 0x00, 0x00, 0x0A, 0x49, 0x44, 0x41,  // IDAT chunk header
      0x54, 0x78, 0x9C, 0x62, 0x00, 0x00, 0x00, 0x02,  // compressed data
      0x00, 0x01, 0xE2, 0x21, 0xBC, 0x33, 0x00, 0x00,  // more data
      0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42,  // IEND chunk
      0x60, 0x82
    ]);
    
    const result = await processImage(pngBuffer, 'image/png', { quality: 90, format: 'jpeg' });
    
    console.log('Valid PNG processing:');
    console.log(`  Result content type: ${result.contentType}`);
    console.log(`  Original size: ${result.originalSize.width}x${result.originalSize.height}`);
    console.log(`  Processed size: ${result.processedSize.width}x${result.processedSize.height}`);
    console.log(`  Compression ratio: ${result.compressionRatio.toFixed(3)}`);
    
    // This should work with actual Sharp processing
    expect(result.contentType).toBe('image/jpeg');
    expect(result.data).toBeInstanceOf(Buffer);
    expect(result.originalSize.width).toBeGreaterThan(0);
    expect(result.originalSize.height).toBeGreaterThan(0);
  });

  test('should handle valid vs invalid image data correctly', async () => {
    const { processImage } = await import('../src/utils/imageProcessor.js');
    
    // Test case that should work with Sharp processing
    const validPng = Buffer.from([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
      0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x01, 0x00, 0x00, 0x00, 0x00, 0x37, 0x6E, 0xF9,
      0x24, 0x00, 0x00, 0x00, 0x0A, 0x49, 0x44, 0x41,
      0x54, 0x78, 0x9C, 0x62, 0x00, 0x00, 0x00, 0x02,
      0x00, 0x01, 0xE2, 0x21, 0xBC, 0x33, 0x00, 0x00,
      0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42,
      0x60, 0x82
    ]);
    
    // Test case that should throw error
    const invalidData = Buffer.from('not an image at all');
    
    // Valid PNG should process successfully
    const validResult = await processImage(validPng, 'image/png', { format: 'jpeg', quality: 80 });
    
    console.log('Valid PNG result:', {
      contentType: validResult.contentType,
      size: `${validResult.originalSize.width}x${validResult.originalSize.height}`,
      dataLength: validResult.data.length
    });
    
    expect(validResult.contentType).toBe('image/jpeg');
    expect(validResult.originalSize.width).toBeGreaterThan(0);
    expect(validResult.originalSize.height).toBeGreaterThan(0);
    
    // Invalid data should throw error
    await expect(processImage(invalidData, 'image/png', { format: 'jpeg', quality: 80 }))
      .rejects.toThrow(/Image processing failed/);
  });
});