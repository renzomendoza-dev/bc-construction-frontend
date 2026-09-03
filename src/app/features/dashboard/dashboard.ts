import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ThemeService } from '../../core/services/theme';
import { CurrentUserService } from '../../core/services/current-user';
import {
  EquipmentResponse,
  EquipmentService,
  InventoryService,
  ItemsService,
  PurchaseReceiptsService,
  TransferBatchesService,
} from '../../generated';

interface InventoryStats {
  items: number;
  lowStock: number;
  pendingReceipts: number;
  awaitingPurchase: number;
}

interface EquipmentStats {
  total: number;
  checkedOut: number;
  overdue: number;
}

const EMPTY_STATS: InventoryStats = { items: 0, lowStock: 0, pendingReceipts: 0, awaitingPurchase: 0 };
const EMPTY_EQUIPMENT_STATS: EquipmentStats = { total: 0, checkedOut: 0, overdue: 0 };

// GET /api/purchase-receipts has no "confirmed" filter, so counting
// drafts means fetching a batch and filtering client-side — same gap
// noted on the Purchase Receipts list page. Fine at current volume;
// revisit if receipt count grows past a single fetch.
const RECEIPTS_FETCH_SIZE = 300;

// Matches the Equipment page's own default overdue threshold
// (OVERDUE_DAY_OPTIONS' initial '7') so this card's number lines up with
// what "Overdue Checkouts" shows if you click through.
const OVERDUE_DAYS = 7;

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
  private readonly transferBatchesService = inject(TransferBatchesService);
  private readonly equipmentService = inject(EquipmentService);

  // The Equipment module's endpoints declare their response content-type as
  // `*/*` in the OpenAPI spec, so the generated client falls back to
  // `responseType: 'blob'`. Forcing the Accept header routes it back onto
  // the JSON parsing path — same workaround as equipment-list.ts.
  private readonly jsonAccept = { httpHeaderAccept: 'application/json' } as unknown as {
    httpHeaderAccept?: '*/*';
  };

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
  protected readonly equipmentStats = signal<EquipmentStats>(EMPTY_EQUIPMENT_STATS);
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
      // Same totalElements-from-a-1-row-page trick as items — search()
      // supports server-side status filtering, so no need to fetch and
      // count every AWAITING_PURCHASE batch just for this number.
      awaitingPurchase: this.transferBatchesService
        .search1(undefined, undefined, 'AWAITING_PURCHASE', 0, 1, undefined)
        .pipe(catchError(() => of(null))),
      // Equipment's list/overdue endpoints return a flat array with no
      // page/size params, so counting means fetching the whole thing —
      // same tradeoff already accepted for lowStock above.
      equipment: this.equipmentService.findAll(undefined, 'body', undefined, this.jsonAccept).pipe(
        catchError(() => of([] as EquipmentResponse[])),
      ),
      overdueEquipment: this.equipmentService.findOverdue(OVERDUE_DAYS, 'body', undefined, this.jsonAccept).pipe(
        catchError(() => of([] as EquipmentResponse[])),
      ),
    }).subscribe(({ items, lowStock, receipts, awaitingPurchase, equipment, overdueEquipment }) => {
      const pendingReceipts = (receipts?.content ?? []).filter((r) => !r.confirmed).length;
      const equipmentList = equipment ?? [];

      this.inventoryStats.set({
        items: items?.totalElements ?? 0,
        lowStock: Array.isArray(lowStock) ? lowStock.length : 0,
        pendingReceipts,
        awaitingPurchase: awaitingPurchase?.totalElements ?? 0,
      });
      this.equipmentStats.set({
        total: equipmentList.length,
        checkedOut: equipmentList.filter(
          (e) => e.status === EquipmentResponse.StatusEnum.CheckedOut || e.status === EquipmentResponse.StatusEnum.InUse,
        ).length,
        overdue: (overdueEquipment ?? []).length,
      });
      this.statsLoading.set(false);
    });
  }
}