import { Injectable, inject } from '@angular/core';
import { Functions, httpsCallable } from '@angular/fire/functions';

@Injectable({
  providedIn: 'root'
})
export class GeminiService {
  private functions = inject(Functions);

  async processCommand(history: {role: string, parts: {text?: string, inlineData?: any}[]}[], schema: any) {
    const processCommandFn = httpsCallable<any, any>(this.functions, 'processCommand');
    
    try {
      const result = await processCommandFn({ history, schema });
      return result.data;
    } catch (error) {
      console.error('Error invoking processCommand function:', error);
      throw error;
    }
  }
}
