import { Injectable, inject, signal } from '@angular/core';
import { Auth, user, signInWithPopup, GoogleAuthProvider, signOut } from '@angular/fire/auth';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private auth = inject(Auth);
  private router = inject(Router);

  public currentUser = signal<any>(null);
  public user$: Observable<any>;

  constructor() {
    this.user$ = user(this.auth);

    this.user$.subscribe((u: any) => {
      this.currentUser.set(u);
      if (u) {
        if (this.router.url === '/login' || this.router.url === '/') {
          this.router.navigate(['/dashboard']);
        }
      } else {
        this.router.navigate(['/login']);
      }
    });
  }

  async loginWithGoogle() {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(this.auth, provider);
  }

  async logout() {
    await signOut(this.auth);
  }
}
