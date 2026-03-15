export interface ChatMessage {
  id: string;
  role: 'user' | 'system' | 'assistant';
  content: string;
  timestamp: Date;
  inlineData?: {
    data: string;
    mimeType: string;
  };
  type?: 'text' | 'entry-card';
  cardData?: any;
  cardContentType?: any;
}
