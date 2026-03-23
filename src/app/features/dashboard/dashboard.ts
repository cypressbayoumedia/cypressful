import { ChangeDetectionStrategy, Component, inject, signal, ViewChild, ElementRef } from '@angular/core';
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
import { ChatInput } from './components/chat-input/chat-input';
import { PowerToolsPanel } from './components/power-tools-panel/power-tools-panel';
import { ImageToolsService } from '../../core/services/image-tools.service';

@Component({
  selector: 'app-dashboard',
  imports: [
    DashboardHeader,
    ContentModelsPanel,
    MediaLibraryPanel,
    EntriesPanel,
    EntryCard,
    AssetPicker,
    ChatInput,
    PowerToolsPanel,
  ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Dashboard {
  private authService = inject(AuthService);
  private voiceService = inject(VoiceService);
  public contentfulService = inject(ContentfulService);
  private geminiService = inject(GeminiService);
  private imageTools = inject(ImageToolsService);

  public user = this.authService.currentUser;
  public currentSpace = this.contentfulService.activeSpace;
  public spaces = this.contentfulService.spaces;

  // Panel visibility
  public showSpaceMenu = signal(false);
  public showModelsPanel = signal(false);
  public showMediaPanel = signal(false);
  public showEntriesPanel = signal(false);
  public showAssetPicker = signal(false);
  public showPowerTools = signal(false);
  public assetPickerTarget = signal<{ msgId: string; fieldId: string } | null>(null);

  // Voice state
  public isListening = this.voiceService.isListening;
  public messageInput = signal('');

  // Chat state
  public messages = signal<ChatMessage[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Hello James. I am ready to update Contentful. What would you like to do?',
      timestamp: new Date()
    }
  ]);

  public stagedImage = signal<File | null>(null);
  public stagedImageBase64 = signal<string | null>(null);
  public isLoading = signal(false);

  @ViewChild('scrollContainer') private scrollContainer!: ElementRef;

  constructor() {
    toObservable(this.voiceService.transcript).subscribe((transcript: string) => {
      if (transcript) {
        this.messageInput.set(transcript);
      }
    });
  }

  // --- Header actions ---
  async logout() {
    await this.authService.logout();
  }

  onSelectSpace(spaceId: string) {
    this.contentfulService.selectSpace(spaceId);
    this.showSpaceMenu.set(false);
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
      this.addSystemMessage(`✅ Converted image uploaded: ${file.name} (Asset ID: ${asset.sys.id})`);
      this.contentfulService.fetchAssets();
    } catch (err: any) {
      this.addSystemMessage(`❌ Upload failed: ${err.message}`);
    }
  }

  async uploadBulkFiles(files: File[]) {
    this.addSystemMessage(`📤 Uploading ${files.length} file${files.length > 1 ? 's' : ''}...`);
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
    const msg = failures > 0
      ? `✅ Uploaded ${successes}/${files.length} files (${failures} failed)`
      : `✅ All ${successes} files uploaded successfully!`;
    this.addSystemMessage(msg);
    this.contentfulService.fetchAssets();
  }

  // --- Media panel actions ---
  async onDeleteAsset(assetId: string) {
    try {
      await this.contentfulService.deleteAsset(assetId);
    } catch (err: any) {
      console.error('Failed to delete asset:', err);
      alert('Failed to delete asset: ' + err.message);
    }
  }

  async onRenameAsset(event: { assetId: string; newTitle: string }) {
    try {
      await this.contentfulService.renameAsset(event.assetId, event.newTitle);
    } catch (err: any) {
      console.error('Failed to rename asset:', err);
      alert('Failed to rename asset: ' + err.message);
    }
  }

  // --- Entries panel actions ---
  async loadEntryForEdit(entry: any) {
    this.showEntriesPanel.set(false);
    const ctId = entry.sys.contentType.sys.id;
    const ct = this.contentfulService.contentTypes().find((c: any) => c.sys.id === ctId);

    this.messages.update(msgs => [
      ...msgs,
      {
        id: Date.now().toString(),
        role: 'user',
        type: 'entry-card',
        content: `Edit ${entry.fields.title?.['en-US'] || entry.sys.id}`,
        timestamp: new Date(),
        cardData: JSON.parse(JSON.stringify(entry)),
        cardContentType: ct
      } as ChatMessage
    ]);
    setTimeout(() => this.scrollToBottom(), 100);
  }

  async unpublishEntryFromPanel(entry: any) {
    if (!entry.sys.publishedVersion) return;
    try {
      await this.contentfulService.unpublishEntry(entry.sys.id);
      this.contentfulService.fetchEntries();
    } catch (err: any) {
      alert('Unpublish failed: ' + err.message);
    }
  }

  async deleteEntryFromPanel(entry: any) {
    try {
      await this.contentfulService.deleteEntry(entry.sys.id);
      this.contentfulService.fetchEntries();
    } catch (err: any) {
      alert('Delete failed: ' + err.message);
    }
  }

  // --- Entry card actions ---
  updateCardField(event: { msgId: string; fieldId: string; value: any }) {
    this.messages.update(msgs => msgs.map(m => {
      if (m.id === event.msgId && m.cardData) {
        const newData = { ...m.cardData };
        if (!newData.fields) newData.fields = {};
        if (!newData.fields[event.fieldId]) newData.fields[event.fieldId] = {};
        newData.fields[event.fieldId]['en-US'] = event.value;
        return { ...m, cardData: newData };
      }
      return m;
    }));
  }

  async saveEntryCard(msgId: string) {
    const msg = this.messages().find(m => m.id === msgId);
    if (!msg || !msg.cardData) return;

    this.isLoading.set(true);
    try {
      const isCreate = !msg.cardData.sys.id;
      const intent = isCreate ? 'create' : 'update';
      const action: any = {
        intent,
        contentTypeId: msg.cardContentType?.sys?.id,
        fields: msg.cardData.fields
      };
      if (!isCreate) action.entryId = msg.cardData.sys.id;

      const resultEntry = await this.contentfulService.executeAction(action);

      this.messages.update(msgs => msgs.map(m => m.id === msgId ? {
        ...m,
        cardData: resultEntry,
        content: isCreate ? `Created ${msg.cardContentType?.name}` : `Updated ${msg.cardContentType?.name}`
      } as ChatMessage : m));

      this.addSystemMessage('✅ Saved successfully to Contentful.');
    } catch (err: any) {
      console.error(err);
      this.addSystemMessage(`❌ Save failed: ${err.message}`);
    } finally {
      this.isLoading.set(false);
      setTimeout(() => this.scrollToBottom(), 100);
    }
  }

  async publishEntryCard(msgId: string) {
    const msg = this.messages().find(m => m.id === msgId);
    if (!msg || !msg.cardData?.sys?.id) return;
    this.isLoading.set(true);
    try {
      const published = await this.contentfulService.publishEntry(msg.cardData.sys.id);
      this.messages.update(msgs => msgs.map(m => m.id === msgId ? { ...m, cardData: published } : m));
      this.addSystemMessage('✅ Entry published live!');
    } catch (err: any) {
      console.error(err);
      this.addSystemMessage(`❌ Publish failed: ${err.message}`);
    } finally {
      this.isLoading.set(false);
      setTimeout(() => this.scrollToBottom(), 100);
    }
  }

  async unpublishEntryCard(msgId: string) {
    const msg = this.messages().find(m => m.id === msgId);
    if (!msg || !msg.cardData?.sys?.id) return;
    this.isLoading.set(true);
    try {
      const unpublished = await this.contentfulService.unpublishEntry(msg.cardData.sys.id);
      this.messages.update(msgs => msgs.map(m => m.id === msgId ? { ...m, cardData: unpublished } : m));
      this.addSystemMessage('⬇️ Entry unpublished — reverted to draft.');
    } catch (err: any) {
      console.error(err);
      this.addSystemMessage(`❌ Unpublish failed: ${err.message}`);
    } finally {
      this.isLoading.set(false);
      setTimeout(() => this.scrollToBottom(), 100);
    }
  }

  async deleteEntryCard(msgId: string) {
    const msg = this.messages().find(m => m.id === msgId);
    if (!msg || !msg.cardData?.sys?.id) return;
    if (!confirm('Are you sure you want to permanently delete this entry?')) return;
    this.isLoading.set(true);
    try {
      await this.contentfulService.deleteEntry(msg.cardData.sys.id);
      this.messages.update(msgs => msgs.map(m => m.id === msgId ? {
        ...m,
        cardData: { ...m.cardData, _deleted: true },
        content: `Deleted ${msg.cardContentType?.name || 'entry'}`
      } : m));
      this.addSystemMessage('🗑️ Entry permanently deleted from Contentful.');
    } catch (err: any) {
      console.error(err);
      this.addSystemMessage(`❌ Delete failed: ${err.message}`);
    } finally {
      this.isLoading.set(false);
      setTimeout(() => this.scrollToBottom(), 100);
    }
  }

  // --- Asset picker actions ---
  openAssetPickerForField(event: { msgId: string; fieldId: string }) {
    this.assetPickerTarget.set(event);
    this.showAssetPicker.set(true);
    this.contentfulService.fetchAssets();
  }

  selectAssetForField(asset: any) {
    const target = this.assetPickerTarget();
    if (!target) return;
    
    const msg = this.messages().find(m => m.id === target.msgId);
    if (!msg || !msg.cardData || !msg.cardContentType) return;

    const fieldDef = msg.cardContentType.fields?.find((f: any) => f.id === target.fieldId);
    const isArray = fieldDef?.type === 'Array';
    
    if (isArray) {
      const currentArray = msg.cardData.fields[target.fieldId]?.['en-US'] || [];
      this.updateCardField({
        msgId: target.msgId,
        fieldId: target.fieldId,
        value: [...currentArray, { sys: { type: 'Link', linkType: 'Asset', id: asset.sys.id } }]
      });
    } else {
      this.updateCardField({
        msgId: target.msgId,
        fieldId: target.fieldId,
        value: { sys: { type: 'Link', linkType: 'Asset', id: asset.sys.id } }
      });
    }
    
    this.showAssetPicker.set(false);
    this.assetPickerTarget.set(null);
  }

  clearAssetField(event: { msgId: string; fieldId: string }) {
    this.updateCardField({ msgId: event.msgId, fieldId: event.fieldId, value: null });
  }

  // --- Chat input actions ---
  toggleVoice() {
    if (this.isListening()) {
      this.voiceService.stopListening();
    } else {
      this.voiceService.startListening();
    }
  }

  onSelectTemplate(contentType: any) {
    const blankEntry = {
      sys: { id: null, type: 'Entry', contentType: { sys: { id: contentType.sys.id } } },
      fields: {}
    };

    this.messages.update(msgs => [
      ...msgs,
      {
        id: Date.now().toString(),
        role: 'user',
        type: 'entry-card',
        content: `Create new ${contentType.name}`,
        timestamp: new Date(),
        cardData: blankEntry,
        cardContentType: contentType
      } as ChatMessage
    ]);
    setTimeout(() => this.scrollToBottom(), 100);
  }

  async onFileSelected(file: File) {
    // Auto-convert HEIC/HEIF and other incompatible formats
    if (this.imageTools.isConvertible(file)) {
      this.addSystemMessage(`🔄 Converting ${file.name} to JPEG...`);
      try {
        const converted = await this.imageTools.autoConvert(file);
        this.stagedImage.set(converted);
        const base64 = await this.imageTools.blobToDataUrl(converted);
        this.stagedImageBase64.set(base64);
        this.addSystemMessage(`✅ Converted to ${converted.name}`);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Conversion failed';
        this.addSystemMessage(`❌ Conversion failed: ${message}. Staging original file.`);
        this.stagedImage.set(file);
        const reader = new FileReader();
        reader.onload = () => this.stagedImageBase64.set(reader.result as string);
        reader.readAsDataURL(file);
      }
    } else {
      this.stagedImage.set(file);
      const reader = new FileReader();
      reader.onload = () => {
        this.stagedImageBase64.set(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  }

  async sendMessage(text: string) {
    if (!text.trim() && !this.stagedImage()) return;

    if (this.isListening()) {
      this.voiceService.stopListening();
    }

    const currentImage = this.stagedImage();
    const currentBase64 = this.stagedImageBase64();

    this.messageInput.set('');
    this.voiceService.transcript.set('');
    this.stagedImage.set(null);
    this.stagedImageBase64.set(null);

    this.messages.update(msgs => [
      ...msgs,
      {
        id: Date.now().toString(),
        role: 'user',
        content: text || 'Uploaded an image',
        timestamp: new Date(),
        ...(currentBase64 ? { inlineData: { data: currentBase64, mimeType: currentImage?.type } } : {})
      } as ChatMessage
    ]);

    this.isLoading.set(true);

    try {
      const thinkingId = Date.now().toString() + '_thinking';
      this.messages.update(msgs => [
        ...msgs,
        { id: thinkingId, role: 'system', content: 'Consulting Gemini schema parser...', timestamp: new Date() }
      ]);

      let assetIdMsg = '';
      if (currentImage) {
        this.messages.update(msgs => msgs.map(m => m.id === thinkingId ? { ...m, content: 'Uploading image to Contentful...' } : m));
        const asset = await this.contentfulService.uploadAsset(currentImage);
        assetIdMsg = `\\n[Context: Image uploaded as Asset ID: ${asset.sys.id}]`;
        this.messages.update(msgs => msgs.map(m => m.id === thinkingId ? { ...m, content: 'Asset created! Consulting Gemini...' } : m));
      }

      const schema = this.contentfulService.contentTypes();
      const history = this.messages()
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .map(m => {
          const parts: any[] = [{ text: m.content }];
          if ((m as any).inlineData) {
            const base64Data = (m as any).inlineData.data.split(',')[1];
            parts.push({ inlineData: { data: base64Data, mimeType: (m as any).inlineData.mimeType } });
          }
          return { role: m.role === 'assistant' ? 'model' : 'user', parts };
        });

      if (assetIdMsg && history.length > 0) {
        history[history.length - 1].parts[0].text += assetIdMsg;
      }

      const response = await this.geminiService.processCommand(history, schema);

      let actionResultMsg = '';
      let entryIdStr = '';
      if (response.intent) {
        try {
          const entry = await this.contentfulService.executeAction(response);
          actionResultMsg = '\\n\\n✅ Action successfully executed.';
          if (response.intent === 'create' && entry?.sys?.id) {
            entryIdStr = `\\nEntry ID: ${entry.sys.id}`;
          }
        } catch (actionErr: any) {
          console.error('Action Execution Error:', actionErr);
          actionResultMsg = `\\n\\n❌ Failed to execute action: ${actionErr.message}`;
        }
      }

      this.messages.update(msgs => [
        ...msgs.filter(m => m.id !== thinkingId),
        {
          id: Date.now().toString() + '_response',
          role: 'assistant',
          content: (response.explanation || 'Action processed.') + actionResultMsg + entryIdStr,
          timestamp: new Date()
        }
      ]);

      console.log('Gemini Parsed Action:', response);
    } catch (error) {
      console.error('Error invoking Gemini:', error);
      this.messages.update(msgs => [
        ...msgs,
        { id: Date.now().toString() + '_error', role: 'system', content: 'Error: Could not reach the Gemini API.', timestamp: new Date() }
      ]);
    } finally {
      this.isLoading.set(false);
    }
  }

  // --- Helpers ---
  private addSystemMessage(content: string) {
    this.messages.update(msgs => [
      ...msgs,
      { id: Date.now().toString() + '_sys', role: 'assistant', content, timestamp: new Date() }
    ]);
  }

  ngAfterViewChecked() {
    this.scrollToBottom();
  }

  private scrollToBottom(): void {
    try {
      if (this.scrollContainer) {
        this.scrollContainer.nativeElement.scrollTop = this.scrollContainer.nativeElement.scrollHeight;
      }
    } catch (err) { }
  }
}
