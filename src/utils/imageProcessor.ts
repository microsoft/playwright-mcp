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

import type { ExpectationOptions } from '../schemas/expectation.js';

export interface ImageProcessingResult {
  data: Buffer;
  contentType: string;
  originalSize: { width: number; height: number };
  processedSize: { width: number; height: number };
  compressionRatio: number;
}

/**
 * Validate image processing options
 */
export function validateImageOptions(options: NonNullable<ExpectationOptions>['imageOptions']): string[] {
  const errors: string[] = [];

  if (options?.quality !== undefined && (options.quality < 1 || options.quality > 100))
    errors.push('Image quality must be between 1 and 100');


  if (options?.maxWidth !== undefined && options.maxWidth < 1)
    errors.push('Max width must be greater than 0');


  if (options?.maxHeight !== undefined && options.maxHeight < 1)
    errors.push('Max height must be greater than 0');


  return errors;
}

/**
 * Process image using Sharp library
 */
export async function processImage(
  imageData: Buffer,
  originalContentType: string,
  options?: NonNullable<ExpectationOptions>['imageOptions']
): Promise<ImageProcessingResult> {
  try {
    const sharp = await import('sharp');

    if (!options) {
      // Get metadata for no-operation case
      const metadata = await sharp.default(imageData).metadata();
      const originalSize = {
        width: metadata.width || 0,
        height: metadata.height || 0
      };

      return {
        data: imageData,
        contentType: originalContentType,
        originalSize,
        processedSize: originalSize,
        compressionRatio: 1.0
      };
    }

    let processor = sharp.default(imageData);
    const metadata = await processor.metadata();
    const originalSize = {
      width: metadata.width || 0,
      height: metadata.height || 0
    };

    const processedSize = { ...originalSize };

    // Apply resize operations
    if (options.maxWidth || options.maxHeight) {
      const resizeOptions: { width?: number; height?: number; fit?: 'inside' } = {
        fit: 'inside' // Maintain aspect ratio
      };

      if (options.maxWidth)
        resizeOptions.width = options.maxWidth;


      if (options.maxHeight)
        resizeOptions.height = options.maxHeight;


      processor = processor.resize(resizeOptions);

      // Calculate processed size
      if (options.maxWidth && originalSize.width > options.maxWidth) {
        const ratio = options.maxWidth / originalSize.width;
        processedSize.width = options.maxWidth;
        processedSize.height = Math.round(originalSize.height * ratio);
      }

      if (options.maxHeight && processedSize.height > options.maxHeight) {
        const ratio = options.maxHeight / processedSize.height;
        processedSize.height = options.maxHeight;
        processedSize.width = Math.round(processedSize.width * ratio);
      }
    }

    // Apply format conversion and quality settings
    let contentType = originalContentType;

    if (options.format) {
      switch (options.format) {
        case 'jpeg':
          contentType = 'image/jpeg';
          processor = processor.jpeg({ quality: options.quality || 85 });
          break;
        case 'webp':
          contentType = 'image/webp';
          processor = processor.webp({ quality: options.quality || 85 });
          break;
        case 'png':
        default:
          contentType = 'image/png';
          processor = processor.png();
          break;
      }
    }

    const processedData = await processor.toBuffer();
    const compressionRatio = imageData.length > 0 ? processedData.length / imageData.length : 1.0;

    return {
      data: processedData,
      contentType,
      originalSize,
      processedSize,
      compressionRatio
    };
  } catch (error) {
    // Sharp processing failed - throw error for caller to handle
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Image processing failed: ${errorMessage}`);
  }
}
