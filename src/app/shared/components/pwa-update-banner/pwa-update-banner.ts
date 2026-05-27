import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { PwaUpdateService } from '../../../core/services/pwa-update.service';

@Component({
  selector: 'app-pwa-update-banner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (pwaUpdateService.updateAvailable()) {
      <div class="fixed bottom-6 left-1/2 -translate-x-1/2 z-[99] w-[calc(100%-2rem)] max-w-md animate-fade-in-up">
        <div class="bg-slate-900/90 border border-emerald-500/30 backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] rounded-2xl p-4 md:p-5 flex flex-col sm:flex-row items-center gap-4 justify-between">
          <div class="flex items-center gap-3.5 text-center sm:text-left">
            <div class="w-12 h-12 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0 shadow-inner">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-6 h-6 animate-pulse">
                <path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
            </div>
            <div>
              <h4 class="font-bold text-white text-sm tracking-wide">Update Available</h4>
              <p class="text-xs text-slate-300 leading-relaxed mt-0.5">
                A newer version of Cypressful is ready on your Pixel.
              </p>
            </div>
          </div>
          <div class="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              (click)="dismiss()"
              class="flex-1 sm:flex-initial px-4 py-2 hover:bg-slate-800 text-slate-400 hover:text-white text-xs font-semibold rounded-xl transition-all cursor-pointer text-center">
              Later
            </button>
            <button
              (click)="reloadApp()"
              class="flex-1 sm:flex-initial px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-500/20 hover:scale-105 active:scale-95 transition-all cursor-pointer text-center flex items-center justify-center gap-1.5">
              Update Now
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: `
    @keyframes fadeInUp {
      from {
        opacity: 0;
        transform: translate(-50%, 1rem);
      }
      to {
        opacity: 1;
        transform: translate(-50%, 0);
      }
    }
    .animate-fade-in-up {
      animation: fadeInUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }
  `
})
export class PwaUpdateBanner {
  public pwaUpdateService = inject(PwaUpdateService);

  reloadApp() {
    this.pwaUpdateService.activateUpdate();
  }

  dismiss() {
    this.pwaUpdateService.updateAvailable.set(false);
  }
}
