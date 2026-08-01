import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ThemeService } from '../../core/services/theme';
import { CurrentUserService } from '../../core/services/current-user';
import { InventoryService, ItemsService, PurchaseReceiptsService } from '../../generated';

interface InventoryStats {
  items: number;
  lowStock: number;
  pendingReceipts: number;
}

const EMPTY_STATS: InventoryStats = { items: 0, lowStock: 0, pendingReceipts: 0 };

// GET /api/purchase-receipts has no "confirmed" filter, so counting
// drafts means fetching a batch and filtering client-side — same gap
// noted on the Purchase Receipts list page. Fine at current volume;
// revisit if receipt count grows past a single fetch.
const RECEIPTS_FETCH_SIZE = 300;

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard implements OnInit {
  private readonly themeService = inject(ThemeService);
  private readonly currentUser = inject(CurrentUserService);
  private readonly itemsService = inject(ItemsService);
  private readonly inventoryService = inject(InventoryService);
  private readonly receiptsService = inject(PurchaseReceiptsService);

  protected readonly isDark = computed(() => this.themeService.theme() === 'dark');
  protected readonly userName = this.currentUser.fullName;

  // Mirrors the ADMIN check in adminGuard/Sidebar — hides the Admin Settings
  // card for users who can't actually reach /users.
  protected readonly isAdmin = computed(() => this.currentUser.roles.includes('ADMIN'));

  protected readonly todayLabel = computed(() =>
    new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  );

  protected readonly inventoryStats = signal<InventoryStats>(EMPTY_STATS);
  protected readonly statsLoading = signal(true);

  ngOnInit(): void {
    this.loadStats();
  }

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }

  private loadStats(): void {
    this.statsLoading.set(true);

    forkJoin({
      // totalElements from a 1-row page avoids pulling the full item list
      // just to get a count.
      items: this.itemsService.listItems(undefined, true, undefined, 0, 1, undefined).pipe(
        catchError(() => of(null)),
      ),
      lowStock: this.inventoryService.getLowStockItems().pipe(
        catchError(() => of([])),
      ),
      receipts: this.receiptsService
        .listPurchaseReceipts(undefined, undefined, undefined, 0, RECEIPTS_FETCH_SIZE, undefined)
        .pipe(catchError(() => of(null))),
    }).subscribe(({ items, lowStock, receipts }) => {
      const pendingReceipts = (receipts?.content ?? []).filter((r) => !r.confirmed).length;

      this.inventoryStats.set({
        items: items?.totalElements ?? 0,
        lowStock: Array.isArray(lowStock) ? lowStock.length : 0,
        pendingReceipts,
      });
      this.statsLoading.set(false);
    });
  }
}