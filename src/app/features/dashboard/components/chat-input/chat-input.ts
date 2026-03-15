import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';

@Component({
  selector: 'app-chat-input',
  templateUrl: './chat-input.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatInput {
  public isLoading = input(false);
  public isListening = input(false);
  public contentTypes = input<any[]>([]);
  public messageInput = input('');

  public sendMessage = output<string>();
  public selectTemplate = output<any>();
  public toggleVoice = output<void>();
  public fileSelected = output<File>();
  public inputChanged = output<string>();

  public showTemplatesPopover = signal(false);
  public stagedImage = signal<File | null>(null);
  public stagedImageBase64 = signal<string | null>(null);

  toggleTemplates() {
    this.showTemplatesPopover.set(!this.showTemplatesPopover());
  }

  onSelectTemplate(contentType: any) {
    this.showTemplatesPopover.set(false);
    this.selectTemplate.emit(contentType);
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
      this.fileSelected.emit(file);
    }
  }

  removeStagedImage() {
    this.stagedImage.set(null);
    this.stagedImageBase64.set(null);
  }

  updateInput(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.inputChanged.emit(value);
  }

  onSend() {
    this.sendMessage.emit(this.messageInput());
  }
}
