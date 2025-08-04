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
/**
 * Validate image processing options
 */
export function validateImageOptions(options) {
    const errors = [];
    if (options?.quality && (options.quality < 1 || options.quality > 100)) {
        errors.push('Image quality must be between 1 and 100');
    }
    if (options?.maxWidth && options.maxWidth < 1) {
        errors.push('Max width must be greater than 0');
    }
    if (options?.maxHeight && options.maxHeight < 1) {
        errors.push('Max height must be greater than 0');
    }
    return errors;
}
/**
 * Process image according to provided options
 * Note: This is a simplified implementation for testing purposes.
 * In production, you would use a proper image processing library like 'sharp'.
 */
export async function processImage(imageData, originalContentType, options) {
    if (!options) {
        return {
            data: imageData,
            contentType: originalContentType,
            originalSize: { width: 0, height: 0 },
            processedSize: { width: 0, height: 0 },
            compressionRatio: 1.0
        };
    }
    // For this implementation, we'll simulate image processing
    // In a real implementation, you would:
    // 1. Use 'sharp' library to process images
    // 2. Apply resize operations based on maxWidth/maxHeight
    // 3. Convert format and apply quality settings
    // 4. Return actual processed data
    const originalSize = { width: 100, height: 100 }; // Simulated
    let processedSize = { ...originalSize };
    // Simulate resize operation
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
    // Simulate format conversion
    let contentType = originalContentType;
    let processedData = imageData;
    if (options.format) {
        switch (options.format) {
            case 'jpeg':
                contentType = 'image/jpeg';
                // Simulate compression - reduce buffer size based on quality
                const qualityFactor = (options.quality || 85) / 100;
                const targetSize = Math.round(imageData.length * qualityFactor);
                processedData = Buffer.alloc(targetSize, imageData[0]);
                break;
            case 'webp':
                contentType = 'image/webp';
                const webpQualityFactor = (options.quality || 85) / 100;
                const webpTargetSize = Math.round(imageData.length * webpQualityFactor * 0.8); // WebP is typically smaller
                processedData = Buffer.alloc(webpTargetSize, imageData[0]);
                break;
            case 'png':
            default:
                contentType = 'image/png';
                // PNG compression doesn't use quality parameter
                processedData = imageData;
                break;
        }
    }
    const compressionRatio = imageData.length > 0 ? processedData.length / imageData.length : 1.0;
    return {
        data: processedData,
        contentType,
        originalSize,
        processedSize,
        compressionRatio
    };
}
