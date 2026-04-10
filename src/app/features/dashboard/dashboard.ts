import { ChangeDetectionStrategy, Component, HostListener, inject, signal, ViewChild, ElementRef, effect, computed } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { AuthService } from '../../core/services/auth.service';
import { VoiceService } from '../../core/services/voice.service';
import { ContentfulService } from '../../core/services/contentful.service';
import { GeminiService } from '../../core/services/gemini.service';
import { ChatMessage } from './models/chat-message.model';
import { DashboardHeader } from './components/dashboard-header/dashboard-header';
import { ContentModelsPanel } from './components/content-models-panel/content-models-panel';
import { MediaLibraryPanel } from './components/media-library-panel/media-library-panel';
import { EntriesPanel } from './components/entries-panel/entries-panel';
import { EntryCard } from './components/entry-card/entry-card';
import { AssetPicker } from './components/asset-picker/asset-picker';
import { EntryPicker } from './components/entry-picker/entry-picker';

import { PowerToolsPanel } from './components/power-tools-panel/power-tools-panel';
import { ImageToolsService } from '../../core/services/image-tools.service';
import { ToastService } from '../../core/services/toast.service';
import { EntryAssistant } from './components/entry-assistant/entry-assistant';

@Component({
  selector: 'app-dashboard',
  imports: [
    DashboardHeader,
    ContentModelsPanel,
    MediaLibraryPanel,
    EntriesPanel,
    EntryCard,
    AssetPicker,
    EntryPicker,
    EntryAssistant,
    PowerToolsPanel,
  ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Dashboard {
  private authService = inject(AuthService);
  public contentfulService = inject(ContentfulService);
  private imageTools = inject(ImageToolsService);
  private toast = inject(ToastService);

  public user = this.authService.currentUser;
  public currentSpace = this.contentfulService.activeSpace;
  public spaces = this.contentfulService.spaces;

  // Panel visibility
  public showSpaceMenu = signal(false);
  public showModelsPanel = signal(false);
  public showMediaPanel = signal(false);
  public showEntriesPanel = signal(false);
  public showAssetPicker = signal(false);
  public showEntryPicker = signal(false);
  public showPowerTools = signal(false);
  public showAssistant = signal(false);
  public assetPickerTarget = signal<{ msgId: string; fieldId: string } | null>(null);
  public entryPickerTarget = signal<{ msgId: string; fieldId: string; isArray: boolean, allowedContentTypes: string[] } | null>(null);

  // Active Entry state (currently edited entry in main view)
  public activeEntry = signal<{ data: any; contentType: any; _deleted?: boolean } | null>(null);

  // Computes a mock message object to bridge compatibility with the existing EntryCard component
  public activeEntryMessage = computed<ChatMessage | null>(() => {
    const entry = this.activeEntry();
    if (!entry) return null;
    return {
      id: 'active',
      role: 'user',
      type: 'entry-card',
      content: '',
      timestamp: new Date(),
      cardData: entry.data,
      cardContentType: entry.contentType
    };
  });

  public isLoading = signal(false);
  public isDragging = signal(false);

  @HostListener('document:keydown.escape')
  onEscapeKey() {
    if (this.showAssetPicker()) { this.showAssetPicker.set(false); this.assetPickerTarget.set(null); }
    else if (this.showPowerTools()) { this.showPowerTools.set(false); }
    else if (this.showEntriesPanel()) { this.showEntriesPanel.set(false); }
    else if (this.showMediaPanel()) { this.showMediaPanel.set(false); }
    else if (this.showModelsPanel()) { this.showModelsPanel.set(false); }
    else if (this.showSpaceMenu()) { this.showSpaceMenu.set(false); }
  }

  @HostListener('dragover', ['$event'])
  onDragOver(event: DragEvent) {
    event.preventDefault();
    this.isDragging.set(true);
  }

  @HostListener('dragleave', ['$event'])
  onDragLeave(event: DragEvent) {
    event.preventDefault();
    this.isDragging.set(false);
  }

  @HostListener('drop', ['$event'])
  onDrop(event: DragEvent) {
    event.preventDefault();
    this.isDragging.set(false);
    
    // We can do something here if we want to handle drag and drop at the dashboard level without the chat open
  }

  // --- Header actions ---
  async logout() {
    await this.authService.logout();
  }

  onSelectSpace(spaceId: string) {
    this.contentfulService.selectSpace(spaceId);
    this.showSpaceMenu.set(false);
  }

  clearSession() {
    // This is now inside the Entry Assistant component, but we keep this stub in case the header needs to call something here.
  }

  openMediaPanel() {
    this.showMediaPanel.set(true);
    this.contentfulService.fetchAssets();
  }

  openEntriesPanel() {
    this.showEntriesPanel.set(true);
    this.contentfulService.fetchEntries();
  }

  // --- Power Tools actions ---
  openPowerTools() {
    this.showPowerTools.set(true);
  }

  async uploadConvertedFile(file: File) {
    this.showPowerTools.set(false);
    try {
      const asset = await this.contentfulService.uploadAsset(file);
      this.toast.success(`Converted image uploaded: ${file.name}`);
      this.contentfulService.fetchAssets();
    } catch (err: any) {
      this.toast.error(`Upload failed: ${this.parseContentfulError(err)}`);
    }
  }

  async uploadBulkFiles(files: File[]) {
    this.toast.info(`Uploading ${files.length} file${files.length > 1 ? 's' : ''}...`);
    let successes = 0;
    let failures = 0;
    for (const file of files) {
      try {
        await this.contentfulService.uploadAsset(file);
        successes++;
      } catch {
        failures++;
      }
    }
    if (failures > 0) {
      this.toast.warning(`Uploaded ${successes}/${files.length} files (${failures} failed)`);
    } else {
      this.toast.success(`All ${successes} files uploaded successfully!`);
    }
    this.contentfulService.fetchAssets();
  }

  // --- Media panel actions ---
  async onDeleteAsset(assetId: string) {
    try {
      await this.contentfulService.deleteAsset(assetId);
      this.toast.success('Asset deleted.');
    } catch (err: any) {
      this.toast.error('Failed to delete asset: ' + this.parseContentfulError(err));
    }
  }

  async onRenameAsset(event: { assetId: string; newTitle: string }) {
    try {
      await this.contentfulService.renameAsset(event.assetId, event.newTitle);
      this.toast.success('Asset renamed.');
    } catch (err: any) {
      this.toast.error('Failed to rename asset: ' + this.parseContentfulError(err));
    }
  }

  async uploadNewMedia(file: File) {
    try {
      await this.contentfulService.uploadAsset(file);
      this.toast.success('Media uploaded successfully.');
    } catch (err: any) {
      this.toast.error('Failed to upload media: ' + this.parseContentfulError(err));
    }
  }

  // --- Entries panel actions ---
  async loadEntryForEdit(entry: any) {
    this.showEntriesPanel.set(false);
    const ctId = entry.sys.contentType.sys.id;
    const ct = this.contentfulService.contentTypes().find((c: any) => c.sys.id === ctId);

    this.activeEntry.set({
      data: JSON.parse(JSON.stringify(entry)),
      contentType: ct
    });
  }

  async unpublishEntryFromPanel(entry: any) {
    if (!entry.sys.publishedVersion) return;
    try {
      await this.contentfulService.unpublishEntry(entry.sys.id);
      this.contentfulService.fetchEntries();
      this.toast.success('Entry unpublished.');
    } catch (err: any) {
      this.toast.error('Unpublish failed: ' + this.parseContentfulError(err));
    }
  }

  async deleteEntryFromPanel(entry: any) {
    try {
      await this.contentfulService.deleteEntry(entry.sys.id);
      this.contentfulService.fetchEntries();
      this.toast.success('Entry deleted.');
    } catch (err: any) {
      this.toast.error('Delete failed: ' + this.parseContentfulError(err));
    }
  }

  // --- Entry card actions ---
  updateActiveCardField(event: { fieldId: string; value: any }) {
    this.activeEntry.update(entry => {
      if (!entry) return null;
      const newData = { ...entry.data };
      if (!newData.fields) newData.fields = {};
      if (!newData.fields[event.fieldId]) newData.fields[event.fieldId] = {};
      newData.fields[event.fieldId]['en-US'] = event.value;
      return { ...entry, data: newData };
    });
  }

  async saveActiveEntry() {
    const entry = this.activeEntry();
    if (!entry || !entry.data) return;

    this.isLoading.set(true);
    try {
      const isCreate = !entry.data.sys.id;
      const intent = isCreate ? 'create' : 'update';
      const action: any = {
        intent,
        contentTypeId: entry.contentType?.sys?.id,
        fields: entry.data.fields
      };
      if (!isCreate) action.entryId = entry.data.sys.id;

      const resultEntry = await this.contentfulService.executeAction(action);

      this.activeEntry.update(e => e ? { ...e, data: resultEntry } : null);

      this.toast.success('Saved successfully to Contentful.');
    } catch (err: any) {
      console.error(err);
      this.toast.error(`Save failed: ${this.parseContentfulError(err)}`);
    } finally {
      this.isLoading.set(false);
    }
  }

  async publishActiveEntry() {
    const entry = this.activeEntry();
    if (!entry || !entry.data?.sys?.id) return;
    this.isLoading.set(true);
    try {
      const published = await this.contentfulService.publishEntry(entry.data.sys.id);
      this.activeEntry.update(e => e ? { ...e, data: published } : null);
      this.toast.success('Entry published live!');
    } catch (err: any) {
      console.error(err);
      this.toast.error(`Publish failed: ${this.parseContentfulError(err)}`);
    } finally {
      this.isLoading.set(false);
    }
  }

  async unpublishActiveEntry() {
    const entry = this.activeEntry();
    if (!entry || !entry.data?.sys?.id) return;
    this.isLoading.set(true);
    try {
      const unpublished = await this.contentfulService.unpublishEntry(entry.data.sys.id);
      this.activeEntry.update(e => e ? { ...e, data: unpublished } : null);
      this.toast.success('Entry unpublished — reverted to draft.');
    } catch (err: any) {
      console.error(err);
      this.toast.error(`Unpublish failed: ${this.parseContentfulError(err)}`);
    } finally {
      this.isLoading.set(false);
    }
  }

  async deleteActiveEntry() {
    const entry = this.activeEntry();
    if (!entry || !entry.data?.sys?.id) return;
    if (!confirm('Are you sure you want to permanently delete this entry?')) return;
    this.isLoading.set(true);
    try {
      await this.contentfulService.deleteEntry(entry.data.sys.id);
      this.activeEntry.set(null); // Clear the view
      this.toast.success('Entry permanently deleted.');
    } catch (err: any) {
      console.error(err);
      this.toast.error(`Delete failed: ${this.parseContentfulError(err)}`);
    } finally {
      this.isLoading.set(false);
    }
  }

  duplicateActiveEntry() {
    const entry = this.activeEntry();
    if (!entry || !entry.data || !entry.contentType) return;
    
    const clonedFields = JSON.parse(JSON.stringify(entry.data.fields || {}));
    const blankEntry = {
      sys: { id: null, type: 'Entry', contentType: { sys: { id: entry.contentType.sys.id } } },
      fields: clonedFields
    };

    this.activeEntry.set({
      data: blankEntry,
      contentType: entry.contentType
    });
    
    this.toast.info('Entry duplicated — edit and save as a new entry.');
  }

  // --- Asset picker actions ---
  openAssetPickerForField(event: { msgId: string, fieldId: string }) {
    this.assetPickerTarget.set(event);
    this.showAssetPicker.set(true);
  }

  openEntryPickerForField(event: { msgId: string, fieldId: string, isArray: boolean, allowedContentTypes: string[] }) {
    this.entryPickerTarget.set(event);
    this.showEntryPicker.set(true);
  }

  selectAssetsForField(assets: any[]) {
    const target = this.assetPickerTarget();
    if (!target || !this.activeEntry()) return;

    this.showAssetPicker.set(false);
    this.assetPickerTarget.set(null);

    const data = { ...this.activeEntry()!.data };
    const fieldId = target.fieldId;
    const currentFieldData = data.fields[fieldId] || {};

    const contentType = this.activeEntry()!.contentType;
    const fieldDef = contentType.fields.find((f: any) => f.id === fieldId);

    if (fieldDef?.type === 'Array') {
      const currentValues = currentFieldData['en-US'] || [];
      const newLinks = assets.map(asset => ({
        sys: { type: 'Link', linkType: 'Asset', id: asset.sys.id }
      }));
      data.fields[fieldId] = { 'en-US': [...currentValues, ...newLinks] };
    } else {
      const selected = assets[0]; // just take first for single link
      data.fields[fieldId] = {
        'en-US': {
          sys: { type: 'Link', linkType: 'Asset', id: selected.sys.id }
        }
      };
    }

    this.activeEntry.set({ data, contentType });
  }

  selectEntriesForField(entries: any[]) {
    const target = this.entryPickerTarget();
    if (!target || !this.activeEntry()) return;

    this.showEntryPicker.set(false);
    this.entryPickerTarget.set(null);

    const data = { ...this.activeEntry()!.data };
    const fieldId = target.fieldId;
    const currentFieldData = data.fields[fieldId] || {};

    if (target.isArray) {
      const currentValues = currentFieldData['en-US'] || [];
      const newLinks = entries.map(entry => ({
        sys: { type: 'Link', linkType: 'Entry', id: entry.sys.id }
      }));
      data.fields[fieldId] = { 'en-US': [...currentValues, ...newLinks] };
    } else {
      const selected = entries[0];
      data.fields[fieldId] = {
        'en-US': {
          sys: { type: 'Link', linkType: 'Entry', id: selected.sys.id }
        }
      };
    }

    this.activeEntry.set({ data, contentType: this.activeEntry()!.contentType });
  }

  async createNewEntryFromPicker(contentTypeId: string) {
    const target = this.entryPickerTarget();
    if (!target || !this.activeEntry()) return;

    this.showEntryPicker.set(false);
    this.entryPickerTarget.set(null);
    this.toast.info('Creating new entry...');

    try {
      const resultEntry = await this.contentfulService.executeAction({
        intent: 'create',
        contentTypeId,
        fields: {}
      });

      const data = { ...this.activeEntry()!.data };
      const fieldId = target.fieldId;
      const currentFieldData = data.fields[fieldId] || {};

      if (target.isArray) {
        const currentValues = currentFieldData['en-US'] || [];
        const newLink = { sys: { type: 'Link', linkType: 'Entry', id: resultEntry.sys.id } };
        data.fields[fieldId] = { 'en-US': [...currentValues, newLink] };
      } else {
        data.fields[fieldId] = {
          'en-US': { sys: { type: 'Link', linkType: 'Entry', id: resultEntry.sys.id } }
        };
      }

      this.activeEntry.set({ data, contentType: this.activeEntry()!.contentType });
      this.toast.success('Successfully created and linked new blank entry!');
      this.contentfulService.fetchEntries();
    } catch (err: any) {
      this.toast.error('Creation failed: ' + this.parseContentfulError(err));
    }
  }

  editLinkedEntry(entryId: string) {
    const entry = this.contentfulService.entries().find(e => e.sys.id === entryId);
    if (!entry) {
      this.toast.error('Could not find entry data.');
      return;
    }
    const contentType = this.contentfulService.contentTypes().find(c => c.sys.id === entry.sys.contentType.sys.id);
    if (!contentType) {
      this.toast.error('Could not find content type for entry.');
      return;
    }
    
    if (confirm('Navigating to this entry will replace your current view. Unsaved changes to the current entry will be lost. Do you want to proceed?')) {
      this.activeEntry.set({
        data: JSON.parse(JSON.stringify(entry)),
        contentType: JSON.parse(JSON.stringify(contentType))
      });
    }
  }

  clearAssetField(event: { fieldId: string }) {
    this.updateActiveCardField({ fieldId: event.fieldId, value: null });
  }

  onSelectTemplate(contentType: any) {
    const blankEntry = {
      sys: { id: null, type: 'Entry', contentType: { sys: { id: contentType.sys.id } } },
      fields: {}
    };

    this.activeEntry.set({
      data: blankEntry,
      contentType: contentType
    });
  }

  onAssistantOpenEntry(event: { entry: any, contentType: any }) {
    this.activeEntry.set({
      data: event.entry,
      contentType: event.contentType
    });
    this.showEntriesPanel.set(false);
  }

  private parseContentfulError(err: any): string {
    if (err?.details?.errors?.length) {
      return err.details.errors.map((e: any) => {
        const field = e.path?.join(' → ') || '';
        const detail = e.details || e.name || 'Unknown error';
        return field ? `${field}: ${detail}` : detail;
      }).join('; ');
    }
    return err?.message || 'Unknown error';
  }
}
