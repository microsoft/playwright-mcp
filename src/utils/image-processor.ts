/**
 * Image processing utilities
 */

import sharp from 'sharp';

export interface ImageOptions {
  quality?: number;
  format?: 'jpeg' | 'png' | 'webp';
  maxWidth?: number;
  maxHeight?: number;
}

export interface ImageSize {
  width: number;
  height: number;
}

export interface ProcessedImage {
  data: Buffer;
  contentType: string;
  originalSize: ImageSize;
  processedSize: ImageSize;
  compressionRatio: number;
}

/**
 * Validate image processing options
 */
export function validateImageOptions(options: ImageOptions): string[] {
  const errors: string[] = [];

  if (
    options.quality !== undefined &&
    (options.quality < 1 || options.quality > 100)
  ) {
    errors.push('quality must be between 1 and 100');
  }

  if (options.maxWidth !== undefined && options.maxWidth <= 0) {
    errors.push('maxWidth must be greater than 0');
  }

  if (options.maxHeight !== undefined && options.maxHeight <= 0) {
    errors.push('maxHeight must be greater than 0');
  }

  return errors;
}

/**
 * Process image without options (return original)
 */
async function processImageWithoutOptions(
  data: Buffer,
  contentType: string
): Promise<ProcessedImage> {
  try {
    const metadata = await sharp(data).metadata();
    return {
      data,
      contentType,
      originalSize: {
        width: metadata.width || 0,
        height: metadata.height || 0,
      },
      processedSize: {
        width: metadata.width || 0,
        height: metadata.height || 0,
      },
      compressionRatio: 1.0,
    };
  } catch {
    // If Sharp fails, return basic structure
    return {
      data,
      contentType,
      originalSize: { width: 0, height: 0 },
      processedSize: { width: 0, height: 0 },
      compressionRatio: 1.0,
    };
  }
}

/**
 * Apply format conversion to image
 */
function applyFormatConversion(
  image: sharp.Sharp,
  format: string,
  quality?: number
): { image: sharp.Sharp; contentType: string } {
  const outputContentType = `image/${format}`;
  let processedImage = image;

  switch (format) {
    case 'jpeg':
      processedImage = image.jpeg({ quality: quality || 80 });
      break;
    case 'png':
      processedImage = image.png({ quality: quality || 100 });
      break;
    case 'webp':
      processedImage = image.webp({ quality: quality || 80 });
      break;
    default:
      // For unsupported formats, keep original
      break;
  }

  return { image: processedImage, contentType: outputContentType };
}

/**
 * Apply quality settings to existing format
 */
function applyQualityToExistingFormat(
  image: sharp.Sharp,
  contentType: string,
  quality: number
): sharp.Sharp {
  if (contentType.includes('jpeg')) {
    return image.jpeg({ quality });
  }
  if (contentType.includes('png')) {
    return image.png({ quality });
  }
  if (contentType.includes('webp')) {
    return image.webp({ quality });
  }
  return image;
}

/**
 * Process an image with optional resizing and format conversion
 */
export async function processImage(
  data: Buffer,
  contentType: string,
  options?: ImageOptions
): Promise<ProcessedImage> {
  // Return original image if no options provided
  if (!options || Object.keys(options).length === 0) {
    return processImageWithoutOptions(data, contentType);
  }

  try {
    // Get original metadata
    const originalMetadata = await sharp(data).metadata();
    const originalSize: ImageSize = {
      width: originalMetadata.width || 0,
      height: originalMetadata.height || 0,
    };

    let image = sharp(data);

    // Apply resizing if specified
    if (options.maxWidth || options.maxHeight) {
      image = image.resize(options.maxWidth, options.maxHeight, {
        fit: 'inside',
        withoutEnlargement: true,
      });
    }

    // Apply format and quality options
    let outputContentType = contentType;
    if (options.format) {
      const result = applyFormatConversion(
        image,
        options.format,
        options.quality
      );
      image = result.image;
      outputContentType = result.contentType;
    } else if (options.quality) {
      image = applyQualityToExistingFormat(image, contentType, options.quality);
    }

    // Process the image
    const processedBuffer = await image.toBuffer();
    const processedMetadata = await sharp(processedBuffer).metadata();

    const processedSize: ImageSize = {
      width: processedMetadata.width || originalSize.width,
      height: processedMetadata.height || originalSize.height,
    };

    // Calculate compression ratio
    const compressionRatio = processedBuffer.length / data.length;

    return {
      data: processedBuffer,
      contentType: outputContentType,
      originalSize,
      processedSize,
      compressionRatio,
    };
  } catch (error) {
    // If processing fails, throw the error (for error handling tests)
    throw new Error(
      `Image processing failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
