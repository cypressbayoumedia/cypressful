import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class VoiceService {
  public isListening = signal<boolean>(false);
  public transcript = signal<string>('');
  private recognition: any;

  constructor() {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = false;
      this.recognition.interimResults = true;

      this.recognition.onresult = (event: any) => {
        let finalTranscript = '';
        let interimTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }
        this.transcript.set(finalTranscript || interimTranscript);
      };

      this.recognition.onend = () => {
        this.isListening.set(false);
      };

      this.recognition.onerror = (event: any) => {
        console.error('Speech recognition error', event.error);
        this.isListening.set(false);
      };
    } else {
      console.warn('Speech Recognition API not supported in this browser.');
    }
  }

  startListening() {
    if (this.recognition && !this.isListening()) {
      this.transcript.set('');
      this.isListening.set(true);
      this.recognition.start();
    }
  }

  stopListening() {
    if (this.recognition && this.isListening()) {
      this.isListening.set(false);
      this.recognition.stop();
    }
  }
}
