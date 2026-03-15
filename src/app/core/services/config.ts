import { Injectable, inject, signal } from '@angular/core';
import { Firestore, doc, setDoc, onSnapshot, Unsubscribe } from '@angular/fire/firestore';
import { AuthService } from './auth.service';

export interface UserConfig {
  cmaToken?: string;
  lastSpaceId?: string;
  spaceUrls?: Record<string, string>;
}

@Injectable({
  providedIn: 'root',
})
export class ConfigService {
  private firestore = inject(Firestore);
  private authService = inject(AuthService);
  
  public config = signal<UserConfig | null>(null);
  private unsub: Unsubscribe | null = null;

  constructor() {
    this.authService.user$.subscribe((user: any) => {
      if (user) {
        this.listenToConfig(user.uid);
      } else {
        if (this.unsub) this.unsub();
        this.config.set(null);
      }
    });
  }

  private listenToConfig(uid: string) {
    const configDoc = doc(this.firestore, `users/${uid}`);
    this.unsub = onSnapshot(configDoc, (docSnap) => {
      if (docSnap.exists()) {
        this.config.set(docSnap.data() as UserConfig);
      } else {
        this.config.set({});
      }
    }, (error) => {
      console.error('Firestore Config Error:', error);
    });
  }

  async saveConfig(newConfig: UserConfig) {
    const user = this.authService.currentUser();
    if (!user) throw new Error('Must be logged in to save config.');
    
    const configDoc = doc(this.firestore, `users/${user.uid}`);
    await setDoc(configDoc, { ...this.config(), ...newConfig }, { merge: true });
  }
}
