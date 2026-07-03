import { Injectable, signal, effect, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export type ThemeMode = 'light' | 'dark' | 'system';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  private get mediaQuery(): MediaQueryList | null {
    return this.isBrowser ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  }

  readonly mode = signal<ThemeMode>(
    this.isBrowser ? ((localStorage.getItem('theme') as ThemeMode) ?? 'system') : 'light'
  );

  readonly isDark = signal<boolean>(this.resolveIsDark());

  constructor() {
    this.mediaQuery?.addEventListener('change', () => {
      if (this.mode() === 'system') {
        this.isDark.set(this.mediaQuery?.matches ?? false);
        this.applyTheme();
      }
    });

    effect(() => {
      const mode = this.mode();
      if (this.isBrowser) localStorage.setItem('theme', mode);
      this.isDark.set(this.resolveIsDark());
      this.applyTheme();
    });
  }

  setMode(mode: ThemeMode): void {
    this.mode.set(mode);
  }

  toggle(): void {
    this.mode.set(this.isDark() ? 'light' : 'dark');
  }

  private resolveIsDark(): boolean {
    const mode = this.mode();
    if (mode === 'system') return this.mediaQuery?.matches ?? false;
    return mode === 'dark';
  }

  private applyTheme(): void {
    if (!this.isBrowser) return;
    const dark = this.isDark();
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    document.body.classList.toggle('dark-theme', dark);
    document.body.classList.toggle('light-theme', !dark);
  }
}
