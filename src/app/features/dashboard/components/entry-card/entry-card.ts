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
  public duplicate = output<string>();

  async copyEntryId() {
    const id = this.message()?.cardData?.sys?.id;
    if (id) {
      await navigator.clipboard.writeText(id);
    }
  }

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

  // --- Rich Text Handlers ---
  extractRichText(richTextObj: any): string {
    if (!richTextObj || !richTextObj.content) return '';
    
    let text = '';
    const walk = (nodes: any[]) => {
      for (const node of nodes) {
        if (node.nodeType === 'text') {
          text += node.value || '';
        } else if (node.content) {
          walk(node.content);
        }
        if (node.nodeType === 'paragraph') {
          text += '\n'; // Add newline for paragraphs
        }
      }
    };
    walk(richTextObj.content);
    return text.trim();
  }

  onRichTextUpdate(fieldId: string, value: string) {
    if (!value.trim()) {
      this.onFieldUpdate(fieldId, null);
      return;
    }

    const paragraphs = value.split('\n').filter(p => p.trim() !== '');
    
    const richTextObj = {
      nodeType: 'document',
      data: {},
      content: paragraphs.map(p => ({
        nodeType: 'paragraph',
        data: {},
        content: [{
          nodeType: 'text',
          value: p,
          marks: [],
          data: {}
        }]
      }))
    };

    this.onFieldUpdate(fieldId, richTextObj);
  }

  onOpenAssetPicker(fieldId: string) {
    this.openAssetPicker.emit({ msgId: this.message().id, fieldId });
  }

  onClearAsset(fieldId: string) {
    this.clearAsset.emit({ msgId: this.message().id, fieldId });
  }

  getFieldValueAsJson(fieldId: string): string {
    const val = this.message().cardData.fields[fieldId]?.['en-US'];
    if (!val) return '';
    if (typeof val === 'string') return val;
    try {
      return JSON.stringify(val, null, 2);
    } catch {
      return '';
    }
  }

  onJsonFieldUpdate(fieldId: string, value: string) {
    let parsed = value;
    try {
      parsed = JSON.parse(value);
    } catch {}
    this.onFieldUpdate(fieldId, parsed);
  }

  // --- Array field helpers ---

  getArrayItems(fieldId: string): any[] {
    const val = this.message().cardData.fields[fieldId]?.['en-US'];
    return Array.isArray(val) ? val : [];
  }

  isLinkArray(fieldId: string): boolean {
    const items = this.getArrayItems(fieldId);
    return items.length > 0 && items[0]?.sys?.type === 'Link';
  }

  getLinkedEntryTitle(linkValue: any): string {
    if (!linkValue?.sys?.id) return 'Unknown';
    // For entries, we don't have them loaded in the card — just show the ID
    return linkValue.sys.id;
  }

  isAssetLink(item: any): boolean {
    return item?.sys?.linkType === 'Asset';
  }

  isEntryLink(item: any): boolean {
    return item?.sys?.linkType === 'Entry';
  }

  getArrayItemLabel(item: any): string {
    if (!item) return '';
    if (typeof item === 'string') return item;
    if (item?.sys?.type === 'Link') {
      const type = item.sys.linkType === 'Asset' ? '🖼️' : '📄';
      const title = item.sys.linkType === 'Asset'
        ? this.getLinkedAssetTitle(item)
        : item.sys.id;
      return `${type} ${title}`;
    }
    return JSON.stringify(item);
  }

  // --- Editable helpers ---

  removeArrayItem(fieldId: string, index: number) {
    const arr = [...this.getArrayItems(fieldId)];
    arr.splice(index, 1);
    this.onFieldUpdate(fieldId, arr);
  }

  addStringToArray(fieldId: string, inputElement: HTMLInputElement) {
    const value = inputElement.value;
    if (!value.trim()) return;
    const arr = [...this.getArrayItems(fieldId)];
    arr.push(value.trim());
    this.onFieldUpdate(fieldId, arr);
    inputElement.value = '';
  }

  addEntryLinkToArray(fieldId: string, inputElement: HTMLInputElement) {
    const entryId = inputElement.value;
    if (!entryId.trim()) return;
    const arr = [...this.getArrayItems(fieldId)];
    arr.push({ sys: { type: 'Link', linkType: 'Entry', id: entryId.trim() } });
    this.onFieldUpdate(fieldId, arr);
    inputElement.value = '';
  }

  setSingleEntryLink(fieldId: string, inputElement: HTMLInputElement) {
    const entryId = inputElement.value;
    if (!entryId.trim()) return;
    this.onFieldUpdate(fieldId, { sys: { type: 'Link', linkType: 'Entry', id: entryId.trim() } });
    inputElement.value = '';
  }

  clearSingleEntryLink(fieldId: string) {
    this.onFieldUpdate(fieldId, null);
  }
}
