import { ChangeDetectionStrategy, Component, input, output, signal, effect, inject, ViewChild, ElementRef } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { ContentfulService } from '../../../../core/services/contentful.service';
import { GeminiService } from '../../../../core/services/gemini.service';
import { VoiceService } from '../../../../core/services/voice.service';
import { ImageToolsService } from '../../../../core/services/image-tools.service';
import { ToastService } from '../../../../core/services/toast.service';
import { ChatMessage } from '../../models/chat-message.model';

@Component({
  selector: 'app-entry-assistant',
  templateUrl: './entry-assistant.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EntryAssistant {
  private contentfulService = inject(ContentfulService);
  private geminiService = inject(GeminiService);
  private voiceService = inject(VoiceService);
  private imageTools = inject(ImageToolsService);
  private toast = inject(ToastService);

  public show = input<boolean>(false);
  public focusedEntry = input<any>(null); // The entry currently focused in the workspace
  public focusedContentType = input<any>(null); // Passed so AI knows the schema of the specific entry

  public toggleAssistant = output<void>();
  public openEntry = output<{ entry: any, contentType: any }>(); // Whenever AI creates/edits something we want the workspace to show

  public isLoading = signal(false);
  public isListening = this.voiceService.isListening;
  public messageInput = signal('');
  public messages = signal<ChatMessage[]>(this.loadSession());

  public stagedImage = signal<File | null>(null);
  public stagedImageBase64 = signal<string | null>(null);

  @ViewChild('scrollContainer') private scrollContainer: any;

  constructor() {
    toObservable(this.voiceService.transcript).subscribe((transcript: unknown) => {
      if (transcript && typeof transcript === 'string') this.messageInput.set(transcript);
    });

    effect(() => {
      localStorage.setItem('cypressful_assistant_session', JSON.stringify(this.messages()));
    });
  }

  private loadSession(): ChatMessage[] {
    const saved = localStorage.getItem('cypressful_assistant_session');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return [{
      id: '1', role: 'assistant',
      content: 'Hello James. I am ready to update Contentful. What would you like to do?',
      timestamp: new Date()
    }];
  }

  clearSession() {
    this.messages.set([this.loadSession()[0]]); // reset to initial
  }

  toggleVoice() {
    if (this.isListening()) this.voiceService.stopListening();
    else this.voiceService.startListening();
  }

  updateInput(event: Event) {
    this.messageInput.set((event.target as HTMLInputElement).value);
  }

  async onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      if (this.imageTools.isConvertible(file)) {
        try {
          const converted = await this.imageTools.autoConvert(file);
          this.stagedImage.set(converted);
          const base64 = await this.imageTools.blobToDataUrl(converted);
          this.stagedImageBase64.set(base64);
        } catch (err) {
          this.stagedImage.set(file);
          const reader = new FileReader();
          reader.onload = () => this.stagedImageBase64.set(reader.result as string);
          reader.readAsDataURL(file);
        }
      } else {
        this.stagedImage.set(file);
        const reader = new FileReader();
        reader.onload = () => this.stagedImageBase64.set(reader.result as string);
        reader.readAsDataURL(file);
      }
    }
  }

  removeStagedImage() {
    this.stagedImage.set(null);
    this.stagedImageBase64.set(null);
  }

  async onSend() {
    const text = this.messageInput();
    if (!text.trim() && !this.stagedImage()) return;

    if (this.isListening()) this.voiceService.stopListening();

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
    setTimeout(() => this.scrollToBottom(), 100);

    try {
      const thinkingId = Date.now().toString() + '_thinking';
      this.messages.update(msgs => [...msgs, { id: thinkingId, role: 'system', content: 'Thinking...', timestamp: new Date() }]);

      let assetIdMsg = '';
      if (currentImage) {
        this.messages.update(msgs => msgs.map(m => m.id === thinkingId ? { ...m, content: 'Uploading image to Contentful...' } : m));
        const asset = await this.contentfulService.uploadAsset(currentImage);
        assetIdMsg = `\n[Context: Image uploaded as Asset ID: ${asset.sys.id}]`;
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

      if (assetIdMsg && history.length > 0) history[history.length - 1].parts[0].text += assetIdMsg;

      // Injects strictly the focused entry to guarantee awareness
      const fEntry = this.focusedEntry();
      const fCt = this.focusedContentType();
      if (fEntry && fCt && history.length > 0) {
        const title = fEntry.fields?.title?.['en-US'] || fEntry.fields?.name?.['en-US'] || 'Untitled';
        const entryId = fEntry.sys.id || 'New Draft';
        history[history.length - 1].parts[0].text += `\n[System Context: The user is currently viewing/editing the entry titled "${title}" (ID: ${entryId}, Content Type: ${fCt.name}). Any actions or questions about "this entry", "it", or "the current entry" MUST apply ONLY to this specific entry.]`;
      }

      const response = await this.geminiService.processCommand(history, schema);

      let actionResultMsg = '';
      let entryIdStr = '';
      if (response.intent) {
        try {
          const entry = await this.contentfulService.executeAction(response);
          actionResultMsg = '\n\n✅ Action successfully executed.';
          if (response.intent === 'create' && entry?.sys?.id) {
            entryIdStr = `\nEntry ID: ${entry.sys.id}`;
            const ct = schema.find((c: any) => c.sys.id === response.contentTypeId);
            this.openEntry.emit({ entry, contentType: ct }); // Notify workspace to display it
          } else if (response.intent === 'update' && entry?.sys?.id) {
            const ct = schema.find((c: any) => c.sys.id === entry.sys.contentType.sys.id);
            this.openEntry.emit({ entry, contentType: ct }); // Refresh workspace view for this entry
          }
        } catch (actionErr: any) {
          actionResultMsg = `\n\n❌ Failed to execute action: ${actionErr.message}`;
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

    } catch (error) {
      this.messages.update(msgs => [...msgs, { id: Date.now().toString() + '_error', role: 'system', content: 'Error connecting to Gemini API.', timestamp: new Date() }]);
    } finally {
      this.isLoading.set(false);
      setTimeout(() => this.scrollToBottom(), 100);
    }
  }

  scrollToBottom() {
    if (this.scrollContainer) {
      this.scrollContainer.nativeElement.scrollTop = this.scrollContainer.nativeElement.scrollHeight;
    }
  }
}
