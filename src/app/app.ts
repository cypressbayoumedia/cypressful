import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastContainer } from './shared/components/toast-container/toast-container';
import { PwaUpdateBanner } from './shared/components/pwa-update-banner/pwa-update-banner';
import { PwaUpdateService } from './core/services/pwa-update.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastContainer, PwaUpdateBanner],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  protected readonly title = signal('cypressful');
  private pwaUpdateService = inject(PwaUpdateService);
}
