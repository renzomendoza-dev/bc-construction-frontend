import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import {
  InventoryService,
  ItemResponse,
  ItemsService,
  MaterialRequestResponse,
  MaterialRequestsService,
  StockLevelResponse,
  TransferBatchCreateRequest,
  TransferLineItemRequest,
  TransferBatchesService,
  WarehouseResponse,
  WarehousesService,
} from '../../../../generated';

interface WarehouseAvailability {
  warehouseId: number;
  warehouseName: string;
  quantity: number;
}

type Direction = 'PULL_OUT' | 'DISPATCH';

interface DraftLine {
  itemId: number | null;
  expectedQuantity: number | null;
  quantity: number | null;
  notes: string;
  // True for a line pre-filled from a fulfilling Material Request — its
  // item is shown as locked text instead of a <select>. Simpler and fully
  // deterministic vs. relying on a native <select>'s [value] binding
  // correctly re-selecting an option for a row that didn't exist in the
  // DOM until the request loaded (it reliably works for the first row but
  // not newly-inserted ones — not worth chasing further given the item
  // isn't meant to change for these lines anyway, only the quantity).
  fromRequest: boolean;
}

function emptyLine(): DraftLine {
  return { itemId: null, expectedQuantity: null, quantity: null, notes: '', fromRequest: false };
}

@Component({
  selector: 'app-transfer-batch-create',
  imports: [],
  templateUrl: './transfer-batch-create.html',
  styleUrl: './transfer-batch-create.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TransferBatchCreateComponent implements OnInit {
  private readonly transferBatchesService = inject(TransferBatchesService);
  private readonly materialRequestsService = inject(MaterialRequestsService);
  private readonly warehousesService = inject(WarehousesService);
  private readonly itemsService = inject(ItemsService);
  private readonly inventoryService = inject(InventoryService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  // Per-item stock lookup, keyed by itemId, populated on demand as items are
  // picked in a line — lets the form warn about a shortfall before hitting
  // the 409 on submit, instead of only finding out after the fact.
  private readonly stockByItemId = signal<Record<number, StockLevelResponse[]>>({});

  // Set when arriving via "Create dispatch from this request" on a
  // Material Request's detail page (?fromRequestId=). Included in the
  // create body so the backend marks that request FULFILLED/
  // PARTIALLY_FULFILLED once this batch is submitted — without it, a
  // dispatch batch has no way to link back to the request it's for.
  readonly sourceMaterialRequestId = signal<number | null>(null);
  readonly fulfillingRequest = signal<MaterialRequestResponse | null>(null);

  readonly warehouses = signal<WarehouseResponse[]>([]);
  readonly items = signal<ItemResponse[]>([]);
  readonly loadingOptions = signal(true);

  // Direction only changes which type (SITE vs MAIN) each dropdown defaults
  // to filtering on, and the page heading — the request body shape sent to
  // the backend is identical either way (just origin/destination ids).
  readonly direction = signal<Direction>('PULL_OUT');

  readonly originWarehouseId = signal<number | null>(null);
  readonly destinationWarehouseId = signal<number | null>(null);
  readonly notes = signal('');
  readonly lines = signal<DraftLine[]>([emptyLine()]);

  readonly saving = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly pageTitle = computed(() =>
    this.direction() === 'PULL_OUT' ? 'Pull-out from Site' : 'Dispatch to Site',
  );

  // Pull-out: site -> warehouse (the site count/audit flow). Dispatch:
  // warehouse -> site. Either dropdown can still be changed to any active
  // warehouse regardless of type — this is just a helpful default, the
  // backend has no type restriction on either side.
  readonly originOptions = computed(() =>
    this.direction() === 'PULL_OUT'
      ? this.warehouses().filter((w) => w.type === WarehouseResponse.TypeEnum.Site)
      : this.warehouses().filter((w) => w.type === WarehouseResponse.TypeEnum.Main),
  );
  readonly destinationOptions = computed(() =>
    this.direction() === 'PULL_OUT'
      ? this.warehouses().filter((w) => w.type === WarehouseResponse.TypeEnum.Main)
      : this.warehouses().filter((w) => w.type === WarehouseResponse.TypeEnum.Site),
  );

  readonly totalItemCount = computed(() =>
    this.lines().reduce((sum, l) => sum + (l.quantity ?? 0), 0),
  );

  ngOnInit(): void {
    const fromRequestId = Number(this.route.snapshot.queryParamMap.get('fromRequestId'));
    this.loadOptions(fromRequestId || null);
  }

  backToList(): void {
    this.router.navigate(['/inventory/transfers']);
  }

  setDirection(direction: Direction): void {
    if (this.direction() === direction) return;
    this.direction.set(direction);
    // Previously picked warehouses are very likely the wrong type for the
    // new direction (e.g. a SITE origin under Pull-out isn't a valid
    // origin under Dispatch) — clear both rather than leave a stale,
    // now-mismatched selection in place.
    this.originWarehouseId.set(null);
    this.destinationWarehouseId.set(null);
  }

  itemName(itemId: number | null): string {
    return this.items().find((i) => i.id === itemId)?.name ?? '';
  }

  // Aggregates that item's stock rows (which are per item+warehouse+location)
  // up to one row per warehouse, since the location breakdown is more detail
  // than useful here.
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

  // How much of this line's item is actually on hand at the currently
  // selected origin — null while stock for that item hasn't loaded yet, so
  // the template can distinguish "still loading" from "confirmed zero".
  originAvailability(itemId: number | null): number | null {
    const originId = this.originWarehouseId();
    if (itemId === null || originId === null) return null;
    if (!(itemId in this.stockByItemId())) return null;
    return this.warehouseAvailability(itemId).find((w) => w.warehouseId === originId)?.quantity ?? 0;
  }

  isShortfall(line: DraftLine): boolean {
    const available = this.originAvailability(line.itemId);
    return available !== null && (line.quantity ?? 0) > available;
  }

  onOriginChange(value: string): void {
    this.originWarehouseId.set(value ? Number(value) : null);
  }

  onDestinationChange(value: string): void {
    this.destinationWarehouseId.set(value ? Number(value) : null);
  }

  onNotesChange(value: string): void {
    this.notes.set(value);
  }

  onLineItemChange(index: number, value: string): void {
    const itemId = value ? Number(value) : null;
    this.lines.update((rows) => rows.map((r, i) => (i === index ? { ...r, itemId } : r)));
    if (itemId !== null) this.ensureStockLoaded(itemId);
  }

  onLineExpectedQtyChange(index: number, value: string): void {
    this.lines.update((rows) =>
      rows.map((r, i) => (i === index ? { ...r, expectedQuantity: value === '' ? null : Number(value) } : r)),
    );
  }

  onLineQtyChange(index: number, value: string): void {
    this.lines.update((rows) =>
      rows.map((r, i) => (i === index ? { ...r, quantity: value === '' ? null : Number(value) } : r)),
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

  saveDraft(): void {
    const originWarehouseId = this.originWarehouseId();
    const destinationWarehouseId = this.destinationWarehouseId();
    const validLines = this.lines().filter((l) => l.itemId !== null && l.quantity && l.quantity > 0);

    if (!originWarehouseId || !destinationWarehouseId) {
      this.errorMessage.set('Origin and destination warehouses are required.');
      return;
    }
    if (originWarehouseId === destinationWarehouseId) {
      this.errorMessage.set('Origin and destination must be different.');
      return;
    }
    if (validLines.length === 0) {
      this.errorMessage.set('At least one complete line item (item, quantity) is required.');
      return;
    }

    this.saving.set(true);
    this.errorMessage.set(null);

    const body: TransferBatchCreateRequest = {
      originWarehouseId,
      destinationWarehouseId,
      sourceMaterialRequestId: this.sourceMaterialRequestId() ?? undefined,
      notes: this.notes().trim() || undefined,
      lines: validLines.map(
        (l): TransferLineItemRequest => ({
          itemId: l.itemId!,
          expectedQuantity: l.expectedQuantity ?? undefined,
          quantity: l.quantity!,
          notes: l.notes.trim() || undefined,
        }),
      ),
    };

    this.transferBatchesService.createDraft(body).subscribe({
      next: (created) => {
        this.saving.set(false);
        this.router.navigate(['/inventory/transfers', created.id]);
      },
      error: (err) => {
        this.saving.set(false);
        this.errorMessage.set(
          err?.status === 400
            ? 'Origin and destination must be different active warehouses, and every line must reference a valid item.'
            : err?.status === 404
              ? 'Origin, destination, or one of the items could not be found.'
              : 'Could not create transfer batch. Please check the form and try again.',
        );
      },
    });
  }

  private loadFulfillingRequest(requestId: number): void {
    this.materialRequestsService.getById(requestId).subscribe({
      next: (request) => {
        this.fulfillingRequest.set(request);
        this.sourceMaterialRequestId.set(request.id ?? null);
        this.direction.set('DISPATCH');
        this.destinationWarehouseId.set(request.siteWarehouseId ?? null);

        const requestLines = request.lines ?? [];
        if (requestLines.length > 0) {
          this.lines.set(
            requestLines.map(
              (l): DraftLine => ({
                itemId: l.itemId ?? null,
                expectedQuantity: null,
                quantity: l.quantityRequested ?? null,
                notes: l.notes ?? '',
                fromRequest: true,
              }),
            ),
          );
          for (const l of requestLines) {
            if (l.itemId !== undefined) this.ensureStockLoaded(l.itemId);
          }
        }
      },
      error: () => {
        this.errorMessage.set('Could not load the material request to fulfill. You can still create a plain dispatch below.');
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
        // lookup just means no hint is shown for this item, not a form error.
      },
    });
  }

  // Loads warehouses/items and only *then* applies the material-request
  // pre-fill (if any) — the pre-fill sets <select>-bound signals
  // (destinationWarehouseId, line itemIds), and a native <select>'s [value]
  // binding silently fails to select an <option> that doesn't exist in the
  // DOM yet. Since Angular only re-writes a property binding when the bound
  // expression's value changes, doing this in parallel meant the dropdowns
  // could resolve to their pre-fill value before the matching <option>s
  // existed, and never get re-applied once they did.
  private loadOptions(fromRequestId: number | null): void {
    this.loadingOptions.set(true);

    forkJoin({
      warehouses: this.warehousesService.listWarehouses(true, 0, 200, undefined),
      items: this.itemsService.listItems(undefined, true, undefined, 0, 300, undefined),
    }).subscribe({
      next: ({ warehouses, items }) => {
        this.warehouses.set(warehouses.content ?? []);
        this.items.set(items.content ?? []);
        this.loadingOptions.set(false);
        if (fromRequestId) {
          this.loadFulfillingRequest(fromRequestId);
        }
      },
      error: () => {
        this.errorMessage.set('Could not load warehouses or items.');
        this.loadingOptions.set(false);
      },
    });
  }
}
