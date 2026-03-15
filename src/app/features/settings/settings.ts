import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ConfigService } from '../../core/services/config';
import { ContentfulService } from '../../core/services/contentful.service';

@Component({
  selector: 'app-settings',
  imports: [RouterLink, FormsModule],
  templateUrl: './settings.html',
  styleUrl: './settings.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Settings {
  public configService = inject(ConfigService);
  public contentfulService = inject(ContentfulService);
  
  public cmaTokenInput = signal<string>('');
  public spaceUrlsInput = signal<Record<string, string>>({});
  public isSavingToken = signal<boolean>(false);
  public saveTokenSuccess = signal<boolean>(false);
  
  public isSavingUrls = signal<boolean>(false);
  public saveUrlsSuccess = signal<boolean>(false);

  constructor() {
    // initialize from existing config
    setTimeout(() => {
      const existing = this.configService.config();
      if (existing?.cmaToken) {
        this.cmaTokenInput.set(existing.cmaToken);
      }
      if (existing?.spaceUrls) {
        this.spaceUrlsInput.set({ ...existing.spaceUrls });
      }
    }, 500);
  }

  updateSpaceUrl(spaceId: string, url: string) {
    this.spaceUrlsInput.update(urls => ({
      ...urls,
      [spaceId]: url
    }));
  }

  async saveToken() {
    this.isSavingToken.set(true);
    try {
      await this.configService.saveConfig({ cmaToken: this.cmaTokenInput() });
      this.saveTokenSuccess.set(true);
      setTimeout(() => this.saveTokenSuccess.set(false), 3000);
    } catch (e) {
      console.error(e);
    } finally {
      this.isSavingToken.set(false);
    }
  }

  async saveUrls() {
    this.isSavingUrls.set(true);
    try {
      await this.configService.saveConfig({ spaceUrls: this.spaceUrlsInput() });
      this.saveUrlsSuccess.set(true);
      setTimeout(() => this.saveUrlsSuccess.set(false), 3000);
    } catch (e) {
      console.error(e);
    } finally {
      this.isSavingUrls.set(false);
    }
  }
}
