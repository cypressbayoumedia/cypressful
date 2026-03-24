import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  dismissing?: boolean;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  public toasts = signal<Toast[]>([]);
  private nextId = 0;

  success(message: string) { this.add(message, 'success'); }
  error(message: string) { this.add(message, 'error'); }
  info(message: string) { this.add(message, 'info'); }
  warning(message: string) { this.add(message, 'warning'); }

  private add(message: string, type: Toast['type']) {
    const id = this.nextId++;
    this.toasts.update(t => [...t, { id, message, type }]);
    setTimeout(() => this.dismiss(id), 4000);
  }

  dismiss(id: number) {
    // Mark as dismissing for animation
    this.toasts.update(t => t.map(toast =>
      toast.id === id ? { ...toast, dismissing: true } : toast
    ));
    // Remove after animation
    setTimeout(() => {
      this.toasts.update(t => t.filter(toast => toast.id !== id));
    }, 300);
  }
}
