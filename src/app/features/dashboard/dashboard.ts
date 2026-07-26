import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ThemeService } from '../../core/services/theme';
import { CurrentUserService } from '../../core/services/current-user';

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard {
  private readonly themeService = inject(ThemeService);
  private readonly currentUser = inject(CurrentUserService);
 
  protected readonly isDark = computed(() => this.themeService.theme() === 'dark');
  protected readonly userName = this.currentUser.fullName;
 
  protected readonly todayLabel = computed(() =>
    new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  );
 
  // TODO: replace with real values once an inventory dashboard-stats
  // endpoint exists. Placeholders match the original design mockup.
  protected readonly inventoryStats = {
    items: 142,
    lowStock: 3,
    pendingReceipts: 5,
  };
 
  toggleTheme(): void {
    this.themeService.toggleTheme();
  }
}
 