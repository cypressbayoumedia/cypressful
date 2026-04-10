import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';

@Component({
  selector: 'app-entry-picker',
  templateUrl: './entry-picker.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EntryPicker {
  public show = input(false);
  public entries = input<any[]>([]);
  public contentTypes = input<any[]>([]);
  public entriesLoading = input(false);
  public allowedContentTypes = input<string[]>([]); // Array of content type IDs

  public closed = output<void>();
  public entriesSelected = output<any[]>();
  public createNew = output<string>();

  public selectedEntries = signal<any[]>([]);

  public filteredEntries = computed(() => {
    const all = this.entries();
    const allowed = this.allowedContentTypes();
    if (!allowed || allowed.length === 0) return all;
    return all.filter(e => allowed.includes(e.sys.contentType.sys.id));
  });

  public availableTypesForCreation = computed(() => {
    const allowed = this.allowedContentTypes();
    const all = this.contentTypes();
    if (allowed.length > 0) {
      return all.filter((ct: any) => allowed.includes(ct.sys.id));
    }
    return all;
  });

  isSelected(entry: any): boolean {
    return this.selectedEntries().some((e: any) => e.sys.id === entry.sys.id);
  }

  toggleSelection(entry: any) {
    const current = this.selectedEntries();
    const index = current.findIndex((e: any) => e.sys.id === entry.sys.id);
    if (index > -1) {
      this.selectedEntries.set(current.filter((e: any) => e.sys.id !== entry.sys.id));
    } else {
      this.selectedEntries.set([...current, entry]);
    }
  }

  confirmSelection() {
    if (this.selectedEntries().length > 0) {
      this.entriesSelected.emit(this.selectedEntries());
      this.selectedEntries.set([]);
    }
  }

  onCreateNew(contentTypeId: string) {
    this.createNew.emit(contentTypeId);
  }

  getEntryTitle(entry: any): string {
    const fields = entry.fields;
    if (!fields) return entry.sys.id;
    const titleField = fields['title'] || fields['name'] || fields['headline'] || fields['internalName'];
    if (titleField) {
      for (const locale of Object.keys(titleField)) {
        if (typeof titleField[locale] === 'string') {
          return titleField[locale];
        }
      }
    }
    return entry.sys.id;
  }

  getContentTypeName(id: string): string {
    const type = this.contentTypes().find((t: any) => t.sys.id === id);
    return type ? type.name : id;
  }

  onClose() {
    this.selectedEntries.set([]);
    this.closed.emit();
  }
}
