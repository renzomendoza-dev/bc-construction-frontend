import { Component, computed, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ThemeService } from '../../services/theme';
import { LayoutService } from '../../services/layout';

@Component({
  selector: 'app-topbar',
  imports: [RouterLink],
  templateUrl: './topbar.html',
  styleUrl: './topbar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Topbar {
  private readonly themeService = inject(ThemeService);
  private readonly layout = inject(LayoutService);
 
  readonly theme = this.themeService.theme;
  readonly isDark = computed(() => this.theme() === 'dark');
 
  readonly menuOpen = signal(false);
 
  // TODO: replace with the real signed-in user once UserSyncService /
  // AppUser data is exposed to the frontend (via /me endpoint or JWT claims).
  readonly userInitials = 'JR';
  readonly userDisplayName = 'J. Rivera';
 
  toggleSidebar(): void {
    this.layout.toggleSidebar();
  }
 
  toggleTheme(): void {
    this.themeService.toggleTheme();
  }
 
  toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }
 
  closeMenu(): void {
    this.menuOpen.set(false);
  }
 
  logOut(): void {
    // TODO: wire to Keycloak logout (redirect to the realm's end-session
    // endpoint) once the frontend's auth integration is in place.
    this.closeMenu();
  }
}
