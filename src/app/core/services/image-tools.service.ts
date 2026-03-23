import { Injectable } from '@angular/core';
import heic2any from 'heic2any';

export type OutputFormat = 'image/jpeg' | 'image/png' | 'image/webp';

export interface ConversionResult {
  blob: Blob;
  fileName: string;
  originalName: string;
  originalSize: number;
  convertedSize: number;
  format: OutputFormat;
}

export interface ImageDimensions {
  width: number;
  height: number;
}

const HEIC_TYPES = ['image/heic', 'image/heif'];
const CONVERTIBLE_TYPES = [
  ...HEIC_TYPES,
  'image/webp',
  'image/tiff',
  'image/bmp',
  'image/avif',
];

@Injectable({ providedIn: 'root' })
export class ImageToolsService {
  /**
   * Check if a file is HEIC/HEIF format (by MIME type or extension).
   */
  isHeic(file: File): boolean {
    if (HEIC_TYPES.includes(file.type.toLowerCase())) return true;
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    return ['heic', 'heif'].includes(ext);
  }

  /**
   * Check if a file is in a format that might need conversion.
   */
  isConvertible(file: File): boolean {
    if (this.isHeic(file)) return true;
    return CONVERTIBLE_TYPES.includes(file.type.toLowerCase());
  }

  /**
   * Convert an image file to the target format.
   * Handles HEIC/HEIF via heic2any, and all other formats via Canvas.
   */
  async convertImage(
    file: File,
    targetFormat: OutputFormat = 'image/jpeg',
    quality = 0.85
  ): Promise<ConversionResult> {
    let sourceBlob: Blob;

    // HEIC/HEIF requires special decoding
    if (this.isHeic(file)) {
      const converted = await heic2any({
        blob: file,
        toType: 'image/png', // decode to PNG first for max quality
        quality: 1,
      });
      sourceBlob = Array.isArray(converted) ? converted[0] : converted;
    } else {
      sourceBlob = file;
    }

    // Use Canvas to convert to target format
    const bitmap = await createImageBitmap(sourceBlob);
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();

    const outputBlob = await canvas.convertToBlob({
      type: targetFormat,
      quality,
    });

    // Generate a new filename
    const baseName = file.name.replace(/\.[^.]+$/, '');
    const ext = targetFormat.split('/')[1];
    const fileName = `${baseName}.${ext}`;

    return {
      blob: outputBlob,
      fileName,
      originalName: file.name,
      originalSize: file.size,
      convertedSize: outputBlob.size,
      format: targetFormat,
    };
  }

  /**
   * Get image dimensions without fully loading the image into the DOM.
   */
  async getImageDimensions(file: File): Promise<ImageDimensions> {
    let blob: Blob = file;
    if (this.isHeic(file)) {
      const converted = await heic2any({
        blob: file,
        toType: 'image/png',
        quality: 0.5,
      });
      blob = Array.isArray(converted) ? converted[0] : converted;
    }
    const bitmap = await createImageBitmap(blob);
    const dims = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return dims;
  }

  /**
   * Convert a Blob to a File object with the given name.
   */
  blobToFile(blob: Blob, fileName: string): File {
    return new File([blob], fileName, { type: blob.type });
  }

  /**
   * Generate a data URL preview from a Blob.
   */
  blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Auto-convert a file to JPEG if it's in an incompatible format.
   * Returns the original file if no conversion is needed.
   */
  async autoConvert(file: File): Promise<File> {
    if (!this.isConvertible(file)) return file;
    const result = await this.convertImage(file, 'image/jpeg', 0.9);
    return this.blobToFile(result.blob, result.fileName);
  }

  /**
   * Format bytes to a human-readable string.
   */
  formatBytes(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }
}
