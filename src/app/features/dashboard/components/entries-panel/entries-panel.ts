import { ChangeDetectionStrategy, Component, input, output, signal, computed } from '@angular/core';

@Component({
  selector: 'app-entries-panel',
  templateUrl: './entries-panel.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EntriesPanel {
  public show = input(false);
  public entries = input<any[]>([]);
  public contentTypes = input<any[]>([]);
  public entriesLoading = input(false);

  public closed = output<void>();
  public editEntry = output<any>();
  public unpublishEntry = output<any>();
  public deleteEntry = output<any>();

  public entryFilter = signal<string>('');
  public searchQuery = signal('');

  public filteredEntries = computed(() => {
    let entries = this.entries();
    if (this.entryFilter()) {
      entries = entries.filter((e: any) => e.sys.contentType.sys.id === this.entryFilter());
    }
    const q = this.searchQuery().toLowerCase().trim();
    if (q) {
      entries = entries.filter((e: any) => {
        const title = (e.fields?.title?.['en-US'] || '').toLowerCase();
        const name = (e.fields?.name?.['en-US'] || '').toLowerCase();
        const internal = (e.fields?.internalName?.['en-US'] || '').toLowerCase();
        return title.includes(q) || name.includes(q) || internal.includes(q);
      });
    }
    return entries;
  });

  getEntryStatus(entry: any): string {
    if (entry.sys.archivedVersion) return 'Archived';
    if (!entry.sys.publishedVersion) return 'Draft';
    if (entry.sys.version > entry.sys.publishedVersion + 1) return 'Changed';
    return 'Published';
  }

  onUnpublish(event: Event, entry: any) {
    event.stopPropagation();
    this.unpublishEntry.emit(entry);
  }

  onDelete(event: Event, entry: any) {
    event.stopPropagation();
    if (!confirm('Permanently delete this entry?')) return;
    this.deleteEntry.emit(entry);
  }
}
