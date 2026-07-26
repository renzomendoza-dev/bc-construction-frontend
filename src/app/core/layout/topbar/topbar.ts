import { Component, computed, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ThemeService } from '../../services/theme';
import { LayoutService } from '../../services/layout';
import { CurrentUserService } from '../../services/current-user';

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

  protected readonly currentUser = inject(CurrentUserService);
  protected readonly userDisplayName = this.currentUser.fullName;
 
  readonly theme = this.themeService.theme;
  readonly isDark = computed(() => this.theme() === 'dark');
 
  readonly menuOpen = signal(false);

  protected get userInitials(): string {
    return this.userDisplayName
      .split(' ')
      .map(part => part[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }

 
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
    this.currentUser.logout();
  }
}
