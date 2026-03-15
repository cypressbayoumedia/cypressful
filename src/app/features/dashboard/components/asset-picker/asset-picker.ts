import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

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
  public assetSelected = output<any>();

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
    this.closed.emit();
  }
}
