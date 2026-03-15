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

  public filteredEntries = computed(() => {
    return this.entries().filter((e: any) => {
      if (!this.entryFilter()) return true;
      return e.sys.contentType.sys.id === this.entryFilter();
    });
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
