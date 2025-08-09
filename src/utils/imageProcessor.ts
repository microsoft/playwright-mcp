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
export function validateImageOptions(
  options: NonNullable<ExpectationOptions>['imageOptions']
): string[] {
  const errors: string[] = [];
  if (
    options?.quality !== undefined &&
    (options.quality < 1 || options.quality > 100)
  ) {
    errors.push('Image quality must be between 1 and 100');
  }
  if (options?.maxWidth !== undefined && options.maxWidth < 1) {
    errors.push('Max width must be greater than 0');
  }
  if (options?.maxHeight !== undefined && options.maxHeight < 1) {
    errors.push('Max height must be greater than 0');
  }
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
      return await processImageWithoutOptions(
        sharp.default,
        imageData,
        originalContentType
      );
    }

    return await processImageWithOptions(
      sharp.default,
      imageData,
      originalContentType,
      options
    );
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Image processing failed: ${errorMessage}`);
  }
}

async function processImageWithoutOptions(
  sharp: typeof import('sharp'),
  imageData: Buffer,
  originalContentType: string
): Promise<ImageProcessingResult> {
  const metadata = await sharp(imageData).metadata();
  const originalSize = {
    width: metadata.width ?? 0,
    height: metadata.height ?? 0,
  };

  return {
    data: imageData,
    contentType: originalContentType,
    originalSize,
    processedSize: originalSize,
    compressionRatio: 1.0,
  };
}

async function processImageWithOptions(
  sharp: typeof import('sharp'),
  imageData: Buffer,
  originalContentType: string,
  options: NonNullable<ExpectationOptions>['imageOptions']
): Promise<ImageProcessingResult> {
  const processor = sharp(imageData);
  const metadata = await processor.metadata();
  const originalSize = {
    width: metadata.width ?? 0,
    height: metadata.height ?? 0,
  };

  const { processor: resizedProcessor, processedSize } = applyResizeOptions(
    processor,
    originalSize,
    options
  );
  const { processor: formattedProcessor, contentType } = applyFormatOptions(
    resizedProcessor,
    originalContentType,
    options
  );

  const processedData = await formattedProcessor.toBuffer();
  const compressionRatio =
    imageData.length > 0 ? processedData.length / imageData.length : 1.0;

  return {
    data: processedData,
    contentType,
    originalSize,
    processedSize,
    compressionRatio,
  };
}

function applyResizeOptions(
  processor: import('sharp').Sharp,
  originalSize: { width: number; height: number },
  options: NonNullable<ExpectationOptions>['imageOptions']
): {
  processor: import('sharp').Sharp;
  processedSize: { width: number; height: number };
} {
  const processedSize = { ...originalSize };

  if (options?.maxWidth || options?.maxHeight) {
    const resizeOptions = buildResizeOptions(options);
    const resizedProcessor = processor.resize(resizeOptions);

    const newProcessedSize = calculateProcessedSize(originalSize, options);
    processedSize.width = newProcessedSize.width;
    processedSize.height = newProcessedSize.height;

    return { processor: resizedProcessor, processedSize };
  }

  return { processor, processedSize };
}

function buildResizeOptions(
  options: NonNullable<ExpectationOptions>['imageOptions']
): { width?: number; height?: number; fit: 'inside' } {
  const resizeOptions: { width?: number; height?: number; fit: 'inside' } = {
    fit: 'inside',
  };

  if (options?.maxWidth) {
    resizeOptions.width = options.maxWidth;
  }
  if (options?.maxHeight) {
    resizeOptions.height = options.maxHeight;
  }

  return resizeOptions;
}

function calculateProcessedSize(
  originalSize: { width: number; height: number },
  options: NonNullable<ExpectationOptions>['imageOptions']
): { width: number; height: number } {
  const processedSize = { ...originalSize };

  if (options?.maxWidth && originalSize.width > options.maxWidth) {
    const ratio = options.maxWidth / originalSize.width;
    processedSize.width = options.maxWidth;
    processedSize.height = Math.round(originalSize.height * ratio);
  }

  if (options?.maxHeight && processedSize.height > options.maxHeight) {
    const ratio = options.maxHeight / processedSize.height;
    processedSize.height = options.maxHeight;
    processedSize.width = Math.round(processedSize.width * ratio);
  }

  return processedSize;
}

function applyFormatOptions(
  processor: import('sharp').Sharp,
  originalContentType: string,
  options: NonNullable<ExpectationOptions>['imageOptions']
): { processor: import('sharp').Sharp; contentType: string } {
  if (options?.format) {
    const formatResult = applySpecificFormat(
      processor,
      options.format,
      options.quality
    );
    return {
      processor: formatResult.processor,
      contentType: formatResult.contentType,
    };
  }

  return { processor, contentType: originalContentType };
}

function applySpecificFormat(
  processor: import('sharp').Sharp,
  format: 'jpeg' | 'png' | 'webp',
  quality?: number
): { processor: import('sharp').Sharp; contentType: string } {
  switch (format) {
    case 'jpeg':
      return {
        processor: processor.jpeg({ quality: quality ?? 85 }),
        contentType: 'image/jpeg',
      };
    case 'webp':
      return {
        processor: processor.webp({ quality: quality ?? 85 }),
        contentType: 'image/webp',
      };
    default:
      return {
        processor: processor.png(),
        contentType: 'image/png',
      };
  }
}
