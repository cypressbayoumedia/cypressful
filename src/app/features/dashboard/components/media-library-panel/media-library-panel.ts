import { ChangeDetectionStrategy, Component, input, output, signal, computed } from '@angular/core';

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
  public renameAsset = output<{ assetId: string; newTitle: string }>();
  public uploadAsset = output<File>();

  public selectedAsset = signal<any | null>(null);
  public isEditing = signal(false);
  public editTitle = signal('');
  public searchQuery = signal('');

  public filteredAssets = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    if (!q) return this.assets();
    return this.assets().filter((a: any) => {
      const title = (a.fields?.title?.['en-US'] || '').toLowerCase();
      const fileName = (a.fields?.file?.['en-US']?.fileName || '').toLowerCase();
      return title.includes(q) || fileName.includes(q);
    });
  });

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

  onFileSelected(event: any) {
    const file = event.target.files?.[0];
    if (file) {
      this.uploadAsset.emit(file);
    }
    // reset input
    event.target.value = '';
  }

  onClose() {
    this.selectedAsset.set(null);
    this.isEditing.set(false);
    this.closed.emit();
  }

  async downloadAsset(asset: any) {
    const url = this.getAssetUrl(asset);
    if (!url) return;
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const fileName = asset.fields?.file?.['en-US']?.fileName || 'download';
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (err) {
      console.error('Download failed:', err);
    }
  }

  startRename(asset: any) {
    this.editTitle.set(asset.fields?.title?.['en-US'] || '');
    this.isEditing.set(true);
  }

  cancelRename() {
    this.isEditing.set(false);
    this.editTitle.set('');
  }

  saveRename() {
    const asset = this.selectedAsset();
    if (!asset || !this.editTitle().trim()) return;
    this.renameAsset.emit({ assetId: asset.sys.id, newTitle: this.editTitle().trim() });
    this.isEditing.set(false);
  }
}
