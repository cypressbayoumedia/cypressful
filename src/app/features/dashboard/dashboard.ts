import { ChangeDetectionStrategy, Component, inject, signal, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { VoiceService } from '../../core/services/voice.service';
import { ContentfulService } from '../../core/services/contentful.service';
import { GeminiService } from '../../core/services/gemini.service';
import { environment } from '../../../environments/environment';

export interface ChatMessage {
  id: string;
  role: 'user' | 'system' | 'assistant';
  content: string;
  timestamp: Date;
  inlineData?: {
    data: string;
    mimeType: string;
  };
}

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Dashboard {
  private authService = inject(AuthService);
  private voiceService = inject(VoiceService);
  public contentfulService = inject(ContentfulService);
  private geminiService = inject(GeminiService);

  public user = this.authService.currentUser;
  
  public currentSpace = this.contentfulService.activeSpace;
  public spaces = this.contentfulService.spaces;
  public showSpaceMenu = signal<boolean>(false);
  public messageInput = signal<string>('');
  
  // Voice state
  public isListening = this.voiceService.isListening;
  
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
  public isLoading = signal<boolean>(false);

  @ViewChild('scrollContainer') private scrollContainer!: ElementRef;
  @ViewChild('chatInput') private chatInput!: ElementRef;

  constructor() {
    // Sync voice transcript to input
    toObservable(this.voiceService.transcript).subscribe((transcript) => {
      if (transcript) {
        this.messageInput.set(transcript);
      }
    });
  }

  async logout() {
    await this.authService.logout();
  }

  toggleVoice() {
    if (this.isListening()) {
      this.voiceService.stopListening();
    } else {
      this.voiceService.startListening();
    }
  }

  ngAfterViewChecked() {
    this.scrollToBottom();
  }

  private scrollToBottom(): void {
    try {
      if (this.scrollContainer) {
        this.scrollContainer.nativeElement.scrollTop = this.scrollContainer.nativeElement.scrollHeight;
      }
    } catch(err) { }
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.stagedImage.set(file);
      const reader = new FileReader();
      reader.onload = () => {
        this.stagedImageBase64.set(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  }

  removeStagedImage() {
    this.stagedImage.set(null);
    this.stagedImageBase64.set(null);
  }

  async sendMessage(text: string) {
    if (!text.trim() && !this.stagedImage()) return;

    if (this.isListening()) {
      this.voiceService.stopListening();
    }

    const currentImage = this.stagedImage();
    const currentBase64 = this.stagedImageBase64();

    // Clear staged immediate to feel snappy
    this.messageInput.set('');
    this.voiceService.transcript.set('');
    this.stagedImage.set(null);
    this.stagedImageBase64.set(null);

    // Add user message to feed
    this.messages.update(msgs => [
      ...msgs,
      {
        id: Date.now().toString(),
        role: 'user',
        content: text || 'Uploaded an image',
        timestamp: new Date(),
        ...(currentBase64 ? { inlineData: { data: currentBase64, mimeType: currentImage?.type } } : {})
      } as any
    ]);

    this.isLoading.set(true);

    try {
      // Create a temporary "thinking" message
      const thinkingId = Date.now().toString() + '_thinking';
      this.messages.update(msgs => [
        ...msgs,
        {
          id: thinkingId,
          role: 'system',
          content: 'Consulting Gemini schema parser...',
          timestamp: new Date()
        }
      ]);

      let assetIdMsg = '';
      if (currentImage) {
        this.messages.update(msgs => msgs.map(m => m.id === thinkingId ? {...m, content: 'Uploading image to Contentful...'} : m));
        const asset = await this.contentfulService.uploadAsset(currentImage);
        assetIdMsg = `\\n[Context: Image uploaded as Asset ID: ${asset.sys.id}]`;
        this.messages.update(msgs => msgs.map(m => m.id === thinkingId ? {...m, content: 'Asset created! Consulting Gemini...'} : m));
      }

      // Call the Firebase Function
      const schema = this.contentfulService.contentTypes();
      
      const history = this.messages()
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .map(m => {
          const parts: any[] = [{ text: m.content }];
          // Pass the base64 stripped of the data: url prefix
          if ((m as any).inlineData) {
              const base64Data = (m as any).inlineData.data.split(',')[1];
              parts.push({
                  inlineData: {
                      data: base64Data,
                      mimeType: (m as any).inlineData.mimeType
                  }
              });
          }
          return {
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: parts
          };
        });

      // Inject the asset ID context into the last message if applicable
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

      // Remove the thinking message and add the real response
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
        {
          id: Date.now().toString() + '_error',
          role: 'system',
          content: 'Error: Could not reach the Gemini API.',
          timestamp: new Date()
        }
      ]);
    } finally {
      this.isLoading.set(false);
      // Auto-focus the input box after sending is complete
      setTimeout(() => {
        if (this.chatInput) {
          this.chatInput.nativeElement.focus();
        }
      }, 0);
    }
  }

  updateInput(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.messageInput.set(value);
  }
}
