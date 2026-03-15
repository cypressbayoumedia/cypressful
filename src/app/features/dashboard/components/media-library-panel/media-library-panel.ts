import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';

@Component({
  selector: 'app-media-library-panel',
  templateUrl: './media-library-panel.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MediaLibraryPanel {
  public show = input(false);
  public assets = input<any[]>([]);
  public assetsLoading = input(false);

  public closed = output<void>();
  public deleteAsset = output<string>();

  public selectedAsset = signal<any | null>(null);

  getAssetUrl(asset: any): string | null {
    const file = asset?.fields?.file?.['en-US'];
    if (!file?.url) return null;
    return file.url.startsWith('//') ? 'https:' + file.url : file.url;
  }

  getAssetSize(asset: any): string {
    const bytes = asset?.fields?.file?.['en-US']?.details?.size;
    if (!bytes) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  isImageAsset(asset: any): boolean {
    const contentType = asset?.fields?.file?.['en-US']?.contentType || '';
    return contentType.startsWith('image/');
  }

  async copyAssetId(id: string) {
    await navigator.clipboard.writeText(id);
  }

  onDeleteAsset(assetId: string) {
    if (!confirm('Delete this asset permanently?')) return;
    this.deleteAsset.emit(assetId);
    this.selectedAsset.set(null);
  }

  onClose() {
    this.selectedAsset.set(null);
    this.closed.emit();
  }
}
