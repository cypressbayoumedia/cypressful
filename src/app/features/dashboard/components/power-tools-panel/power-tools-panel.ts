import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import {
  ImageToolsService,
  ConversionResult,
  OutputFormat,
} from '../../../../core/services/image-tools.service';

interface BulkItem {
  file: File;
  status: 'pending' | 'converting' | 'uploading' | 'done' | 'error';
  preview?: string;
  error?: string;
}

@Component({
  selector: 'app-power-tools-panel',
  templateUrl: './power-tools-panel.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PowerToolsPanel {
  private imageTools = inject(ImageToolsService);

  public show = input(false);
  public closed = output<void>();
  public uploadConverted = output<File>();
  public uploadBulk = output<File[]>();

  // Active tab
  public activeTab = signal<'converter' | 'bulk'>('converter');

  // --- Converter state ---
  public sourceFile = signal<File | null>(null);
  public sourcePreview = signal<string | null>(null);
  public convertedResult = signal<ConversionResult | null>(null);
  public convertedPreview = signal<string | null>(null);
  public targetFormat = signal<OutputFormat>('image/jpeg');
  public quality = signal(85);
  public isConverting = signal(false);
  public converterError = signal<string | null>(null);

  // --- Bulk Upload state ---
  public bulkFiles = signal<BulkItem[]>([]);
  public isBulkUploading = signal(false);

  onClose() {
    this.resetConverter();
    this.bulkFiles.set([]);
    this.closed.emit();
  }

  // ═══════════════════════════════════════
  //  CONVERTER
  // ═══════════════════════════════════════

  async onConverterFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.converterError.set(null);
    this.convertedResult.set(null);
    this.convertedPreview.set(null);
    this.sourceFile.set(file);

    // Generate preview — for HEIC we need to convert first
    try {
      if (this.imageTools.isHeic(file)) {
        this.sourcePreview.set(null); // Will show placeholder until converted
      } else {
        const url = await this.imageTools.blobToDataUrl(file);
        this.sourcePreview.set(url);
      }
    } catch {
      this.sourcePreview.set(null);
    }

    // Reset the input so re-selecting the same file works
    input.value = '';
  }

  async convert() {
    const file = this.sourceFile();
    if (!file) return;

    this.isConverting.set(true);
    this.converterError.set(null);

    try {
      const result = await this.imageTools.convertImage(
        file,
        this.targetFormat(),
        this.quality() / 100
      );
      this.convertedResult.set(result);

      const previewUrl = await this.imageTools.blobToDataUrl(result.blob);
      this.convertedPreview.set(previewUrl);

      // Also update source preview if it was HEIC (now we can show it)
      if (!this.sourcePreview()) {
        this.sourcePreview.set(previewUrl);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Conversion failed';
      this.converterError.set(message);
    } finally {
      this.isConverting.set(false);
    }
  }

  uploadConvertedFile() {
    const result = this.convertedResult();
    if (!result) return;
    const file = this.imageTools.blobToFile(result.blob, result.fileName);
    this.uploadConverted.emit(file);
    this.resetConverter();
  }

  downloadConvertedFile() {
    const result = this.convertedResult();
    if (!result) return;
    const url = URL.createObjectURL(result.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = result.fileName;
    a.click();
    URL.revokeObjectURL(url);
  }

  resetConverter() {
    this.sourceFile.set(null);
    this.sourcePreview.set(null);
    this.convertedResult.set(null);
    this.convertedPreview.set(null);
    this.converterError.set(null);
    this.isConverting.set(false);
  }

  // ═══════════════════════════════════════
  //  BULK UPLOAD
  // ═══════════════════════════════════════

  async onBulkFilesSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    if (!files || files.length === 0) return;

    const items: BulkItem[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      let preview: string | undefined;
      try {
        if (!this.imageTools.isHeic(file)) {
          preview = await this.imageTools.blobToDataUrl(file);
        }
      } catch { /* ignore preview failures */ }
      items.push({ file, status: 'pending', preview });
    }

    this.bulkFiles.update(existing => [...existing, ...items]);
    input.value = '';
  }

  removeBulkItem(index: number) {
    this.bulkFiles.update(items => items.filter((_, i) => i !== index));
  }

  clearBulkItems() {
    this.bulkFiles.set([]);
  }

  async startBulkUpload() {
    const items = this.bulkFiles();
    if (items.length === 0) return;

    this.isBulkUploading.set(true);
    const readyFiles: File[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.status === 'done') continue;

      // Convert if needed
      if (this.imageTools.isConvertible(item.file)) {
        this.updateBulkStatus(i, 'converting');
        try {
          const converted = await this.imageTools.autoConvert(item.file);
          readyFiles.push(converted);
          this.updateBulkStatus(i, 'uploading');
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Conversion failed';
          this.updateBulkStatus(i, 'error', message);
          continue;
        }
      } else {
        readyFiles.push(item.file);
        this.updateBulkStatus(i, 'uploading');
      }
    }

    if (readyFiles.length > 0) {
      this.uploadBulk.emit(readyFiles);
    }

    // Mark all uploading items as done (the parent handles actual upload)
    this.bulkFiles.update(items =>
      items.map(item => item.status === 'uploading' ? { ...item, status: 'done' as const } : item)
    );

    this.isBulkUploading.set(false);
  }

  private updateBulkStatus(index: number, status: BulkItem['status'], error?: string) {
    this.bulkFiles.update(items =>
      items.map((item, i) => i === index ? { ...item, status, error } : item)
    );
  }

  // ═══════════════════════════════════════
  //  HELPERS
  // ═══════════════════════════════════════

  formatBytes(bytes: number): string {
    return this.imageTools.formatBytes(bytes);
  }

  getFileExtension(name: string): string {
    return name.split('.').pop()?.toUpperCase() ?? '';
  }
}
