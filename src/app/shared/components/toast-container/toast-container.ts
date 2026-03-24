import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-toast-container',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm pointer-events-none">
      @for (toast of toastService.toasts(); track toast.id) {
        <div
          class="flex items-start gap-3 px-4 py-3 rounded-2xl shadow-2xl shadow-black/40 backdrop-blur-xl border pointer-events-auto cursor-pointer transition-all duration-300"
          [class]="getToastClasses(toast.type)"
          [class.animate-slide-in-right]="!toast.dismissing"
          [class.animate-slide-out-right]="toast.dismissing"
          (click)="toastService.dismiss(toast.id)">
          <span class="text-lg leading-none mt-0.5">{{ getIcon(toast.type) }}</span>
          <p class="text-sm font-medium flex-1 leading-snug">{{ toast.message }}</p>
        </div>
      }
    </div>
  `,
})
export class ToastContainer {
  public toastService = inject(ToastService);

  getToastClasses(type: string): string {
    switch (type) {
      case 'success': return 'bg-emerald-900/90 border-emerald-500/40 text-emerald-100';
      case 'error': return 'bg-red-900/90 border-red-500/40 text-red-100';
      case 'warning': return 'bg-amber-900/90 border-amber-500/40 text-amber-100';
      case 'info': return 'bg-blue-900/90 border-blue-500/40 text-blue-100';
      default: return 'bg-slate-800/90 border-slate-600 text-slate-100';
    }
  }

  getIcon(type: string): string {
    switch (type) {
      case 'success': return '✅';
      case 'error': return '❌';
      case 'warning': return '⚠️';
      case 'info': return 'ℹ️';
      default: return '💬';
    }
  }
}
