import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';

@Component({
  selector: 'app-asset-picker',
  templateUrl: './asset-picker.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AssetPicker {
  public show = input(false);
  public assets = input<any[]>([]);
  public assetsLoading = input(false);

  public closed = output<void>();
  public assetsSelected = output<any[]>();

  public selectedAssets = signal<any[]>([]);

  isSelected(asset: any): boolean {
    return this.selectedAssets().some((a: any) => a.sys.id === asset.sys.id);
  }

  toggleSelection(asset: any) {
    const current = this.selectedAssets();
    const index = current.findIndex((a: any) => a.sys.id === asset.sys.id);
    if (index > -1) {
      this.selectedAssets.set(current.filter((a: any) => a.sys.id !== asset.sys.id));
    } else {
      this.selectedAssets.set([...current, asset]);
    }
  }

  confirmSelection() {
    if (this.selectedAssets().length > 0) {
      this.assetsSelected.emit(this.selectedAssets());
      this.selectedAssets.set([]);
    }
  }

  getAssetUrl(asset: any): string | null {
    const file = asset?.fields?.file?.['en-US'];
    if (!file?.url) return null;
    return file.url.startsWith('//') ? 'https:' + file.url : file.url;
  }

  isImageAsset(asset: any): boolean {
    const contentType = asset?.fields?.file?.['en-US']?.contentType || '';
    return contentType.startsWith('image/');
  }

  onClose() {
    this.selectedAssets.set([]);
    this.closed.emit();
  }
}
