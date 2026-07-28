import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import {
  InventoryService,
  ItemResponse,
  ItemsService,
  LowStockItemResponse,
  StockAdjustmentRequest,
  StockLevelResponse,
  StockMovementResponse,
  StockTransferRequest,
  StorageLocationResponse,
  WarehouseResponse,
  WarehousesService,
} from '../../../../generated';

type Tab = 'levels' | 'lowstock' | 'history';
type MovementType = 'IN' | 'OUT' | 'TRANSFER' | 'ADJUSTMENT';

interface FlatLocation {
  key: string; // `${warehouseId}:${locationId}`
  warehouseId: number;
  warehouseName: string;
  locationId: number;
  code: string;
  label: string;
}

const LEVELS_PAGE_SIZE = 6;
// GET /api/inventory has no search-by-name/sku param and no location
// filter — only itemId/warehouseId. Fetching one large batch and
// filtering client-side, same pattern as Suppliers/Warehouses.
const FETCH_SIZE = 500;

@Component({
  selector: 'app-stock-levels',
  imports: [DatePipe],
  templateUrl: './stock-levels.html',
  styleUrl: './stock-levels.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StockLevelsComponent implements OnInit {
  private readonly inventoryService = inject(InventoryService);
  private readonly warehousesService = inject(WarehousesService);
  private readonly itemsService = inject(ItemsService);

  readonly tab = signal<Tab>('levels');

  // ---- Shared option data (warehouses/locations/items for filters + modals) ----
  readonly warehouses = signal<WarehouseResponse[]>([]);
  readonly locations = signal<FlatLocation[]>([]);
  readonly items = signal<ItemResponse[]>([]);

  readonly warehouseNames = computed(() =>
    Array.from(new Set(this.warehouses().map((w) => w.name).filter((n): n is string => !!n))).sort(),
  );

  // ---- Levels tab ----
  private readonly allStock = signal<StockLevelResponse[]>([]);
  readonly stockLoading = signal(false);
  readonly stockError = signal<string | null>(null);

  readonly search = signal('');
  readonly warehouseFilter = signal('all');
  readonly locationFilter = signal('all');
  readonly page = signal(1);

  readonly locationCodes = computed(() =>
    Array.from(new Set(this.allStock().map((r) => r.locationCode).filter((c): c is string => !!c))).sort(),
  );

  readonly filteredStock = computed(() => {
    const term = this.search().trim().toLowerCase();
    const wh = this.warehouseFilter();
    const loc = this.locationFilter();
    return this.allStock().filter((r) => {
      if (wh !== 'all' && r.warehouseName !== wh) return false;
      if (loc !== 'all' && r.locationCode !== loc) return false;
      if (term) {
        const name = (r.itemName ?? '').toLowerCase();
        const sku = (r.sku ?? '').toLowerCase();
        if (!name.includes(term) && !sku.includes(term)) return false;
      }
      return true;
    });
  });

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.filteredStock().length / LEVELS_PAGE_SIZE)));
  readonly currentPage = computed(() => Math.min(this.page(), this.totalPages()));
  readonly pageItems = computed(() => {
    const start = (this.currentPage() - 1) * LEVELS_PAGE_SIZE;
    return this.filteredStock().slice(start, start + LEVELS_PAGE_SIZE);
  });
  readonly pageSummary = computed(() => {
    const total = this.filteredStock().length;
    if (total === 0) return 'No results';
    const start = (this.currentPage() - 1) * LEVELS_PAGE_SIZE + 1;
    const end = Math.min(this.currentPage() * LEVELS_PAGE_SIZE, total);
    return `Showing ${start}–${end} of ${total}`;
  });

  // ---- Low stock tab ----
  readonly lowStockRows = signal<LowStockItemResponse[]>([]);
  readonly lowStockLoaded = signal(false);
  readonly lowStockLoading = signal(false);
  readonly lowStockError = signal<string | null>(null);
  readonly lowStockCount = computed(() => this.lowStockRows().length);

  // ---- History tab ----
  private readonly allHistory = signal<StockMovementResponse[]>([]);
  readonly historyLoaded = signal(false);
  readonly historyLoading = signal(false);
  readonly historyError = signal<string | null>(null);

  readonly historyItemFilter = signal('');
  readonly historyWarehouseFilter = signal('all');
  readonly historyTypeFilter = signal<'all' | MovementType>('all');

  readonly historyRows = computed(() => {
    const term = this.historyItemFilter().trim().toLowerCase();
    const wh = this.historyWarehouseFilter();
    const type = this.historyTypeFilter();
    return this.allHistory().filter((h) => {
      if (wh !== 'all' && h.warehouseId !== this.warehouseIdByName(wh)) return false;
      if (type !== 'all' && h.type !== type) return false;
      if (term && !(h.itemName ?? '').toLowerCase().includes(term)) return false;
      return true;
    });
  });

  // ---- Adjust modal ----
  readonly adjustOpen = signal(false);
  readonly adjustItemId = signal<number | null>(null);
  readonly adjustLocationKey = signal<string | null>(null);
  readonly adjustQty = signal('');
  readonly adjustReason = signal('');
  readonly adjustSaving = signal(false);
  readonly adjustError = signal<string | null>(null);

  // ---- Transfer modal ----
  readonly transferOpen = signal(false);
  readonly transferItemId = signal<number | null>(null);
  readonly transferFromKey = signal<string | null>(null);
  readonly transferToKey = signal<string | null>(null);
  readonly transferQty = signal('');
  readonly transferSaving = signal(false);
  readonly transferError = signal<string | null>(null);

  ngOnInit(): void {
    this.loadOptions();
    this.fetchStock();
  }

  // ---- Tabs ----

  selectTab(tab: Tab): void {
    this.tab.set(tab);
    if (tab === 'lowstock' && !this.lowStockLoaded()) this.fetchLowStock();
    if (tab === 'history' && !this.historyLoaded()) this.fetchHistory();
  }

  // ---- Levels filters ----

  onSearchChange(value: string): void {
    this.search.set(value);
    this.page.set(1);
  }

  onWarehouseFilterChange(value: string): void {
    this.warehouseFilter.set(value);
    this.page.set(1);
  }

  onLocationFilterChange(value: string): void {
    this.locationFilter.set(value);
    this.page.set(1);
  }

  prevPage(): void {
    this.page.update((p) => Math.max(1, p - 1));
  }

  nextPage(): void {
    this.page.update((p) => Math.min(this.totalPages(), p + 1));
  }

  isRowLow(row: StockLevelResponse): boolean {
    return row.reorderThreshold !== undefined && row.reorderThreshold !== null && (row.quantity ?? 0) <= row.reorderThreshold;
  }

  // ---- History filters ----

  onHistoryItemFilterChange(value: string): void {
    this.historyItemFilter.set(value);
  }

  onHistoryWarehouseFilterChange(value: string): void {
    this.historyWarehouseFilter.set(value);
  }

  onHistoryTypeFilterChange(value: 'all' | MovementType): void {
    this.historyTypeFilter.set(value);
  }

  movementQtyLabel(h: StockMovementResponse): string {
    const qty = h.quantity ?? 0;
    const negative = h.type === 'OUT' || h.type === 'TRANSFER';
    return negative ? `-${qty}` : `+${qty}`;
  }

  // StockMovementResponse only carries warehouseId, not a warehouseName
  // field (unlike StockLevelResponse) — resolve it from the warehouses
  // already loaded for the filter dropdowns.
  warehouseName(id: number | undefined): string {
    if (id === undefined) return '—';
    return this.warehouses().find((w) => w.id === id)?.name ?? `#${id}`;
  }

  // ---- Adjust modal ----

  openAdjust(): void {
    this.adjustItemId.set(this.items()[0]?.id ?? null);
    this.adjustLocationKey.set(this.locations()[0]?.key ?? null);
    this.adjustQty.set('');
    this.adjustReason.set('');
    this.adjustError.set(null);
    this.adjustOpen.set(true);
  }

  closeAdjust(): void {
    this.adjustOpen.set(false);
  }

  onAdjustItemChange(value: string): void {
    this.adjustItemId.set(value ? Number(value) : null);
  }

  onAdjustLocationChange(value: string): void {
    this.adjustLocationKey.set(value || null);
  }

  onAdjustQtyChange(value: string): void {
    this.adjustQty.set(value);
  }

  onAdjustReasonChange(value: string): void {
    this.adjustReason.set(value);
  }

  submitAdjust(): void {
    const itemId = this.adjustItemId();
    const location = this.locations().find((l) => l.key === this.adjustLocationKey());
    const qty = parseInt(this.adjustQty(), 10);

    if (!itemId || !location) {
      this.adjustError.set('Item and location are required.');
      return;
    }
    if (!qty || qty === 0 || Number.isNaN(qty)) {
      this.adjustError.set('Enter a non-zero whole number, e.g. -5 or 20.');
      return;
    }

    // The API has no "downward ADJUSTMENT" — ADJUSTMENT only supports
    // upward corrections. A negative value here has to become an OUT
    // movement instead, not a negative-quantity ADJUSTMENT.
    const type: MovementType = qty > 0 ? 'ADJUSTMENT' : 'OUT';
    const body: StockAdjustmentRequest = {
      itemId,
      warehouseId: location.warehouseId,
      locationId: location.locationId,
      quantity: Math.abs(qty),
      type,
      reason: this.adjustReason().trim() || undefined,
    };

    this.adjustSaving.set(true);
    this.adjustError.set(null);

    this.inventoryService.adjustStock(body).subscribe({
      next: () => {
        this.adjustSaving.set(false);
        this.adjustOpen.set(false);
        this.fetchStock();
        this.lowStockLoaded.set(false);
        this.historyLoaded.set(false);
      },
      error: (err) => {
        this.adjustSaving.set(false);
        this.adjustError.set(
          err?.status === 409
            ? 'This would drop the balance below zero.'
            : 'Could not apply adjustment. Please check the form and try again.',
        );
      },
    });
  }

  // ---- Transfer modal ----

  openTransfer(): void {
    this.transferItemId.set(this.items()[0]?.id ?? null);
    this.transferFromKey.set(this.locations()[0]?.key ?? null);
    this.transferToKey.set(this.locations()[1]?.key ?? this.locations()[0]?.key ?? null);
    this.transferQty.set('');
    this.transferError.set(null);
    this.transferOpen.set(true);
  }

  closeTransfer(): void {
    this.transferOpen.set(false);
  }

  onTransferItemChange(value: string): void {
    this.transferItemId.set(value ? Number(value) : null);
  }

  onTransferFromChange(value: string): void {
    this.transferFromKey.set(value || null);
  }

  onTransferToChange(value: string): void {
    this.transferToKey.set(value || null);
  }

  onTransferQtyChange(value: string): void {
    this.transferQty.set(value);
  }

  submitTransfer(): void {
    const itemId = this.transferItemId();
    const from = this.locations().find((l) => l.key === this.transferFromKey());
    const to = this.locations().find((l) => l.key === this.transferToKey());
    const qty = parseInt(this.transferQty(), 10);

    if (!itemId || !from || !to) {
      this.transferError.set('Item, source, and destination are required.');
      return;
    }
    if (from.key === to.key) {
      this.transferError.set('Source and destination must be different.');
      return;
    }
    if (!qty || qty <= 0 || Number.isNaN(qty)) {
      this.transferError.set('Enter a quantity greater than zero.');
      return;
    }

    const body: StockTransferRequest = {
      itemId,
      fromWarehouseId: from.warehouseId,
      fromLocationId: from.locationId,
      toWarehouseId: to.warehouseId,
      toLocationId: to.locationId,
      quantity: qty,
    };

    this.transferSaving.set(true);
    this.transferError.set(null);

    this.inventoryService.transferStock(body).subscribe({
      next: () => {
        this.transferSaving.set(false);
        this.transferOpen.set(false);
        this.fetchStock();
        this.lowStockLoaded.set(false);
        this.historyLoaded.set(false);
      },
      error: (err) => {
        this.transferSaving.set(false);
        this.transferError.set(
          err?.status === 409
            ? 'Insufficient stock at the source location.'
            : 'Could not transfer stock. Please check the form and try again.',
        );
      },
    });
  }

  // ---- Data loading ----

  private warehouseIdByName(name: string): number | undefined {
    return this.warehouses().find((w) => w.name === name)?.id;
  }

  private fetchStock(): void {
    this.stockLoading.set(true);
    this.stockError.set(null);
    this.inventoryService.listStock(undefined, undefined, 0, FETCH_SIZE, undefined).subscribe({
      next: (result) => {
        this.allStock.set(result.content ?? []);
        this.stockLoading.set(false);
      },
      error: () => {
        this.stockError.set('Could not load stock levels. Please try again.');
        this.stockLoading.set(false);
      },
    });
  }

  private fetchLowStock(): void {
    this.lowStockLoading.set(true);
    this.lowStockError.set(null);
    this.inventoryService.getLowStockItems().subscribe({
      next: (rows) => {
        this.lowStockRows.set(Array.isArray(rows) ? rows : []);
        this.lowStockLoaded.set(true);
        this.lowStockLoading.set(false);
      },
      error: () => {
        this.lowStockError.set('Could not load low-stock items. Please try again.');
        this.lowStockLoading.set(false);
      },
    });
  }

  private fetchHistory(): void {
    this.historyLoading.set(true);
    this.historyError.set(null);
    this.inventoryService.getMovementHistory(undefined, undefined, undefined, undefined, 0, FETCH_SIZE, undefined).subscribe({
      next: (result) => {
        this.allHistory.set(result.content ?? []);
        this.historyLoaded.set(true);
        this.historyLoading.set(false);
      },
      error: () => {
        this.historyError.set('Could not load movement history. Please try again.');
        this.historyLoading.set(false);
      },
    });
  }

  private loadOptions(): void {
    this.itemsService.listItems(undefined, true, undefined, 0, 300, undefined).subscribe({
      next: (result) => this.items.set(result.content ?? []),
    });

    this.warehousesService.listWarehouses(true, 0, 200, undefined).subscribe({
      next: (result) => {
        const list = result.content ?? [];
        this.warehouses.set(list);
        this.loadLocations(list);
      },
    });
  }

  private loadLocations(warehouses: WarehouseResponse[]): void {
    const withIds = warehouses.filter((w): w is WarehouseResponse & { id: number; name: string } => w.id !== undefined && !!w.name);
    if (withIds.length === 0) return;

    forkJoin(
      withIds.map((w) =>
        this.warehousesService.listStorageLocations(w.id, true).pipe(catchError(() => of([] as StorageLocationResponse[]))),
      ),
    ).subscribe((results) => {
      const flat: FlatLocation[] = [];
      withIds.forEach((w, i) => {
        const locs = Array.isArray(results[i]) ? results[i] : [];
        for (const loc of locs) {
          if (loc.id === undefined || !loc.code) continue;
          flat.push({
            key: `${w.id}:${loc.id}`,
            warehouseId: w.id,
            warehouseName: w.name,
            locationId: loc.id,
            code: loc.code,
            label: `${w.name} · ${loc.code}`,
          });
        }
      });
      this.locations.set(flat);
    });
  }
}