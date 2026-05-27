import { ApplicationRef, inject, Injectable, signal } from '@angular/core';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { concat, interval } from 'rxjs';
import { filter, first } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class PwaUpdateService {
  private swUpdate = inject(SwUpdate);
  private appRef = inject(ApplicationRef);

  public updateAvailable = signal(false);

  constructor() {
    if (!this.swUpdate.isEnabled) {
      console.log('PWA Service Worker is not enabled (likely in development mode).');
      return;
    }

    this.setupUpdateChecks();
  }

  private setupUpdateChecks() {
    // 1. Listen for new versions ready
    this.swUpdate.versionUpdates
      .pipe(
        filter((evt): evt is VersionReadyEvent => evt.type === 'VERSION_READY')
      )
      .subscribe(() => {
        console.log('A new version of the app is ready for activation.');
        this.updateAvailable.set(true);
      });

    // 2. Check for updates on startup when stable
    const appIsStable$ = this.appRef.isStable.pipe(
      filter((isStable) => isStable),
      first()
    );

    // 3. Periodically check for updates (every 1 hour)
    const checkInterval$ = interval(60 * 60 * 1000); // 1 hour
    const checkOnceAndPeriodically$ = concat(appIsStable$, checkInterval$);

    checkOnceAndPeriodically$.subscribe(() => this.checkForUpdates());
  }

  public async checkForUpdates(): Promise<boolean> {
    if (!this.swUpdate.isEnabled) return false;
    try {
      console.log('Checking for application updates...');
      return await this.swUpdate.checkForUpdate();
    } catch (err) {
      console.error('Failed to check for service worker updates:', err);
      return false;
    }
  }

  public async activateUpdate() {
    if (!this.swUpdate.isEnabled) return;
    try {
      console.log('Activating update...');
      await this.swUpdate.activateUpdate();
      console.log('Update activated successfully. Reloading page...');
      window.location.reload();
    } catch (err) {
      console.error('Failed to activate service worker update:', err);
      // Fallback reload anyway in case of error
      window.location.reload();
    }
  }
}
