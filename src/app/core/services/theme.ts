import { effect, Injectable, Service, signal } from '@angular/core';

const STORAGE_KEY = 'bc-theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly _theme = signal<'light' | 'dark'>(this.readInitial());
 
  readonly theme = this._theme.asReadonly();
 
  constructor() {
    // Keeps <html data-theme="..."> in sync with the signal, and persists
    // the choice so it survives a refresh. This runs once here instead of
    // every component that cares about theme having its own host binding.
    effect(() => {
      const value = this._theme();
      document.documentElement.setAttribute('data-theme', value);
      localStorage.setItem(STORAGE_KEY, value);
    });
  }
 
  toggleTheme(): void {
    this._theme.update((t) => (t === 'dark' ? 'light' : 'dark'));
  }
 
  private readInitial(): 'light' | 'dark' {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
}
 