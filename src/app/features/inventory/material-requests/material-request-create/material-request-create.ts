import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  InventoryService,
  ItemResponse,
  ItemsService,
  MaterialRequestCreateRequest,
  MaterialRequestLineItemRequest,
  MaterialRequestsService,
  StockLevelResponse,
  WarehouseResponse,
  WarehousesService,
} from '../../../../generated';

interface WarehouseAvailability {
  warehouseId: number;
  warehouseName: string;
  quantity: number;
}

interface DraftLine {
  itemId: number | null;
  quantityRequested: number | null;
  notes: string;
}

function emptyLine(): DraftLine {
  return { itemId: null, quantityRequested: null, notes: '' };
}

@Component({
  selector: 'app-material-request-create',
  imports: [],
  templateUrl: './material-request-create.html',
  styleUrl: './material-request-create.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MaterialRequestCreateComponent implements OnInit {
  private readonly materialRequestsService = inject(MaterialRequestsService);
  private readonly warehousesService = inject(WarehousesService);
  private readonly itemsService = inject(ItemsService);
  private readonly inventoryService = inject(InventoryService);
  private readonly router = inject(Router);

  // Per-item stock lookup, keyed by itemId, populated on demand as items are
  // picked in a line — purely informational here (a request has no origin
  // warehouse of its own to compare against, unlike a transfer batch).
  private readonly stockByItemId = signal<Record<number, StockLevelResponse[]>>({});

  private readonly warehouses = signal<WarehouseResponse[]>([]);
  readonly items = signal<ItemResponse[]>([]);
  readonly loadingOptions = signal(true);

  // A site is just a Warehouse with type SITE — a request only makes sense
  // against one (a MAIN warehouse fulfills requests, it doesn't make them).
  readonly sites = computed(() => this.warehouses().filter((w) => w.type === WarehouseResponse.TypeEnum.Site));

  readonly siteWarehouseId = signal<number | null>(null);
  readonly dateNeeded = signal('');
  readonly notes = signal('');
  readonly lines = signal<DraftLine[]>([emptyLine()]);

  readonly saving = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly totalItemCount = computed(() =>
    this.lines().reduce((sum, l) => sum + (l.quantityRequested ?? 0), 0),
  );

  ngOnInit(): void {
    this.loadOptions();
  }

  backToList(): void {
    this.router.navigate(['/inventory/material-requests']);
  }

  onSiteChange(value: string): void {
    this.siteWarehouseId.set(value ? Number(value) : null);
  }

  onDateNeededChange(value: string): void {
    this.dateNeeded.set(value);
  }

  onNotesChange(value: string): void {
    this.notes.set(value);
  }

  // Excludes items already picked on other lines, so the same item can't be
  // added twice — the current line's own selection stays in its own list
  // (excluded only from every *other* line's options) so it still shows as
  // selected.
  itemOptionsFor(index: number): ItemResponse[] {
    const chosenElsewhere = new Set(
      this.lines()
        .filter((_, i) => i !== index)
        .map((l) => l.itemId)
        .filter((id): id is number => id !== null),
    );
    return this.items().filter((item) => item.id === undefined || !chosenElsewhere.has(item.id));
  }

  onLineItemChange(index: number, value: string): void {
    const itemId = value ? Number(value) : null;
    this.lines.update((rows) => rows.map((r, i) => (i === index ? { ...r, itemId } : r)));
    if (itemId !== null) this.ensureStockLoaded(itemId);
  }

  // Aggregates that item's stock rows (per item+warehouse+location) up to
  // one row per warehouse — the location breakdown is more detail than
  // useful here.
  warehouseAvailability(itemId: number | null): WarehouseAvailability[] {
    if (itemId === null) return [];
    const rows = this.stockByItemId()[itemId] ?? [];
    const byWarehouse = new Map<number, WarehouseAvailability>();
    for (const row of rows) {
      if (row.warehouseId === undefined) continue;
      const existing = byWarehouse.get(row.warehouseId);
      if (existing) {
        existing.quantity += row.quantity ?? 0;
      } else {
        byWarehouse.set(row.warehouseId, {
          warehouseId: row.warehouseId,
          warehouseName: row.warehouseName ?? `#${row.warehouseId}`,
          quantity: row.quantity ?? 0,
        });
      }
    }
    return Array.from(byWarehouse.values()).sort((a, b) => b.quantity - a.quantity);
  }

  onLineQtyChange(index: number, value: string): void {
    this.lines.update((rows) =>
      rows.map((r, i) => (i === index ? { ...r, quantityRequested: value === '' ? null : Number(value) } : r)),
    );
  }

  onLineNotesChange(index: number, value: string): void {
    this.lines.update((rows) => rows.map((r, i) => (i === index ? { ...r, notes: value } : r)));
  }

  addLine(): void {
    this.lines.update((rows) => [...rows, emptyLine()]);
  }

  removeLine(index: number): void {
    this.lines.update((rows) => (rows.length > 1 ? rows.filter((_, i) => i !== index) : rows));
  }

  createRequest(): void {
    const siteWarehouseId = this.siteWarehouseId();
    const validLines = this.lines().filter((l) => l.itemId !== null && l.quantityRequested && l.quantityRequested > 0);

    if (!siteWarehouseId) {
      this.errorMessage.set('Site is required.');
      return;
    }
    if (validLines.length === 0) {
      this.errorMessage.set('At least one complete line item (item, quantity) is required.');
      return;
    }

    this.saving.set(true);
    this.errorMessage.set(null);

    const body: MaterialRequestCreateRequest = {
      siteWarehouseId,
      dateNeeded: this.dateNeeded() || undefined,
      notes: this.notes().trim() || undefined,
      lines: validLines.map(
        (l): MaterialRequestLineItemRequest => ({
          itemId: l.itemId!,
          quantityRequested: l.quantityRequested!,
          notes: l.notes.trim() || undefined,
        }),
      ),
    };

    this.materialRequestsService.create(body).subscribe({
      next: (created) => {
        this.saving.set(false);
        this.router.navigate(['/inventory/material-requests', created.id]);
      },
      error: (err) => {
        this.saving.set(false);
        this.errorMessage.set(
          err?.status === 400
            ? 'The selected site must be a SITE-type warehouse, and every line must reference a valid item.'
            : err?.status === 404
              ? 'The site, or one of the items, could not be found.'
              : 'Could not create material request. Please check the form and try again.',
        );
      },
    });
  }

  private ensureStockLoaded(itemId: number): void {
    if (itemId in this.stockByItemId()) return;
    this.inventoryService.listStock(itemId, undefined, 0, 50, undefined).subscribe({
      next: (result) => {
        this.stockByItemId.update((map) => ({ ...map, [itemId]: (result.content ?? []) as StockLevelResponse[] }));
      },
      error: () => {
        // Availability is a helpful hint, not a hard requirement — a failed
        // lookup just means no hint is shown for this item.
      },
    });
  }

  private loadOptions(): void {
    this.loadingOptions.set(true);

    this.warehousesService.listWarehouses(true, 0, 200, undefined).subscribe({
      next: (result) => this.warehouses.set(result.content ?? []),
      error: () => this.errorMessage.set('Could not load sites.'),
    });

    this.itemsService.listItems(undefined, true, undefined, 0, 300, undefined).subscribe({
      next: (result) => {
        this.items.set(result.content ?? []);
        this.loadingOptions.set(false);
      },
      error: () => {
        this.errorMessage.set('Could not load items.');
        this.loadingOptions.set(false);
      },
    });
  }
}
