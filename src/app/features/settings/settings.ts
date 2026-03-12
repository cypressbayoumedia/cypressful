import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ConfigService } from '../../core/services/config';

@Component({
  selector: 'app-settings',
  imports: [RouterLink, FormsModule],
  templateUrl: './settings.html',
  styleUrl: './settings.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Settings {
  public configService = inject(ConfigService);
  
  public cmaTokenInput = signal<string>('');
  public isSaving = signal<boolean>(false);
  public saveSuccess = signal<boolean>(false);

  constructor() {
    // initialize from existing config
    setTimeout(() => {
      const existing = this.configService.config();
      if (existing?.cmaToken) {
        this.cmaTokenInput.set(existing.cmaToken);
      }
    }, 500);
  }

  async saveSettings() {
    this.isSaving.set(true);
    try {
      await this.configService.saveConfig({ cmaToken: this.cmaTokenInput() });
      this.saveSuccess.set(true);
      setTimeout(() => this.saveSuccess.set(false), 3000);
    } catch (e) {
      console.error(e);
    } finally {
      this.isSaving.set(false);
    }
  }
}
