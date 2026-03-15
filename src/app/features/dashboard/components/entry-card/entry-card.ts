import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { LowerCasePipe } from '@angular/common';
import { ChatMessage } from '../../models/chat-message.model';

@Component({
  selector: 'app-entry-card',
  imports: [LowerCasePipe],
  templateUrl: './entry-card.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EntryCard {
  public message = input.required<ChatMessage>();
  public isLoading = input(false);
  public assets = input<any[]>([]);

  public save = output<string>();
  public publish = output<string>();
  public unpublish = output<string>();
  public deleteEntry = output<string>();
  public updateField = output<{ msgId: string; fieldId: string; value: any }>();
  public openAssetPicker = output<{ msgId: string; fieldId: string }>();
  public clearAsset = output<{ msgId: string; fieldId: string }>();

  getEntryStatus(entry: any): string {
    if (entry.sys.archivedVersion) return 'Archived';
    if (!entry.sys.publishedVersion) return 'Draft';
    if (entry.sys.version > entry.sys.publishedVersion + 1) return 'Changed';
    return 'Published';
  }

  getLinkedAssetUrl(linkValue: any): string | null {
    if (!linkValue?.sys?.id) return null;
    const asset = this.assets().find((a: any) => a.sys.id === linkValue.sys.id);
    if (!asset) return null;
    return this.getAssetUrl(asset);
  }

  getLinkedAssetTitle(linkValue: any): string {
    if (!linkValue?.sys?.id) return '';
    const asset = this.assets().find((a: any) => a.sys.id === linkValue.sys.id);
    return asset?.fields?.title?.['en-US'] || linkValue.sys.id;
  }

  private getAssetUrl(asset: any): string | null {
    const file = asset?.fields?.file?.['en-US'];
    if (!file?.url) return null;
    return file.url.startsWith('//') ? 'https:' + file.url : file.url;
  }

  onFieldUpdate(fieldId: string, value: any) {
    this.updateField.emit({ msgId: this.message().id, fieldId, value });
  }

  onOpenAssetPicker(fieldId: string) {
    this.openAssetPicker.emit({ msgId: this.message().id, fieldId });
  }

  onClearAsset(fieldId: string) {
    this.clearAsset.emit({ msgId: this.message().id, fieldId });
  }
}
