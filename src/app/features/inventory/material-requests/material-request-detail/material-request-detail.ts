import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  InventoryService,
  ItemResponse,
  ItemsService,
  MaterialRequestLineItemRequest,
  MaterialRequestResponse,
  MaterialRequestsService,
  MaterialRequestUpdateRequest,
  StockLevelResponse,
} from '../../../../generated';

interface WarehouseAvailability {
  warehouseId: number;
  warehouseName: string;
  quantity: number;
}
import { CurrentUserService } from '../../../../core/services/current-user';
import { Permission } from '../../../../core/constants/permissions';

type Mode = 'view' | 'edit';

interface DraftLine {
  itemId: number | null;
  quantityRequested: number | null;
  notes: string;
}

function emptyLine(): DraftLine {
  return { itemId: null, quantityRequested: null, notes: '' };
}

@Component({
  selector: 'app-material-request-detail',
  imports: [DatePipe, RouterLink],
  templateUrl: './material-request-detail.html',
  styleUrl: './material-request-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MaterialRequestDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly materialRequestsService = inject(MaterialRequestsService);
  private readonly itemsService = inject(ItemsService);
  private readonly inventoryService = inject(InventoryService);
  private readonly currentUser = inject(CurrentUserService);

  // Per-item stock lookup, keyed by itemId, populated on demand while
  // editing — purely informational, same as on the create screen.
  private readonly stockByItemId = signal<Record<number, StockLevelResponse[]>>({});

  readonly canCreateDispatch = this.currentUser.hasPermission(Permission.TransferBatchCreate);
  readonly canEdit = this.currentUser.hasPermission(Permission.MaterialRequestEdit);

  readonly request = signal<MaterialRequestResponse | null>(null);
  readonly loading = signal(true);
  readonly errorMessage = signal<string | null>(null);

  // ---- Edit mode ----
  // Locking rule confirmed directly against the backend's documented
  // behavior for PUT /api/inventory/material-requests/{id}: rejected with
  // 422 once PARTIALLY_FULFILLED or FULFILLED. A transfer batch that merely
  // references this request but hasn't been submitted yet does NOT lock it.
  readonly mode = signal<Mode>('view');
  readonly items = signal<ItemResponse[]>([]);
  readonly itemsLoaded = signal(false);

  readonly editDateNeeded = signal('');
  readonly editNotes = signal('');
  readonly editLines = signal<DraftLine[]>([emptyLine()]);
  readonly saving = signal(false);

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!id) {
      this.errorMessage.set('Invalid material request id.');
      this.loading.set(false);
      return;
    }
    this.loadRequest(id);
  }

  backToList(): void {
    this.router.navigate(['/inventory/material-requests']);
  }

  canDispatch(request: MaterialRequestResponse): boolean {
    return this.canCreateDispatch && request.status !== MaterialRequestResponse.StatusEnum.Fulfilled;
  }

  isLocked(request: MaterialRequestResponse): boolean {
    return (
      request.status === MaterialRequestResponse.StatusEnum.PartiallyFulfilled ||
      request.status === MaterialRequestResponse.StatusEnum.Fulfilled
    );
  }

  canShowEdit(request: MaterialRequestResponse): boolean {
    return this.canEdit && !this.isLocked(request);
  }

  statusLabel(request: MaterialRequestResponse): string {
    switch (request.status) {
      case MaterialRequestResponse.StatusEnum.Draft:
        return 'Draft';
      case MaterialRequestResponse.StatusEnum.Submitted:
        return 'Submitted';
      case MaterialRequestResponse.StatusEnum.PartiallyFulfilled:
        return 'Partially Fulfilled';
      case MaterialRequestResponse.StatusEnum.Fulfilled:
        return 'Fulfilled';
      default:
        return '—';
    }
  }

  itemName(itemId: number | null): string {
    return this.items().find((i) => i.id === itemId)?.name ?? '';
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

  // ---- Enter/cancel edit ----

  enterEdit(): void {
    const current = this.request();
    if (!current) return;

    this.errorMessage.set(null);
    this.mode.set('edit');

    // The line items' <select> is bound to items() for its <option>s — its
    // [value] binding silently fails to select an option that doesn't
    // exist in the DOM yet, and Angular won't retry once it does. So the
    // form can only be populated once items() has actually loaded.
    if (this.itemsLoaded()) {
      this.applyEditForm(current);
    } else {
      this.loadItems(() => this.applyEditForm(current));
    }
  }

  private applyEditForm(request: MaterialRequestResponse): void {
    this.syncFormFromRequest(request);
    for (const line of request.lines ?? []) {
      if (line.itemId !== undefined) this.ensureStockLoaded(line.itemId);
    }
  }

  cancelEdit(): void {
    const current = this.request();
    if (current) this.syncFormFromRequest(current);
    this.errorMessage.set(null);
    this.mode.set('view');
  }

  private syncFormFromRequest(request: MaterialRequestResponse): void {
    this.editDateNeeded.set(request.dateNeeded ?? '');
    this.editNotes.set(request.notes ?? '');
    const lines = request.lines ?? [];
    this.editLines.set(
      lines.length > 0
        ? lines.map(
            (l): DraftLine => ({
              itemId: l.itemId ?? null,
              quantityRequested: l.quantityRequested ?? null,
              notes: l.notes ?? '',
            }),
          )
        : [emptyLine()],
    );
  }

  // ---- Edit form field handlers ----

  onEditDateNeededChange(value: string): void {
    this.editDateNeeded.set(value);
  }

  onEditNotesChange(value: string): void {
    this.editNotes.set(value);
  }

  onEditLineItemChange(index: number, value: string): void {
    const itemId = value ? Number(value) : null;
    this.editLines.update((rows) => rows.map((r, i) => (i === index ? { ...r, itemId } : r)));
    if (itemId !== null) this.ensureStockLoaded(itemId);
  }

  onEditLineQtyChange(index: number, value: string): void {
    this.editLines.update((rows) =>
      rows.map((r, i) => (i === index ? { ...r, quantityRequested: value === '' ? null : Number(value) } : r)),
    );
  }

  onEditLineNotesChange(index: number, value: string): void {
    this.editLines.update((rows) => rows.map((r, i) => (i === index ? { ...r, notes: value } : r)));
  }

  addEditLine(): void {
    this.editLines.update((rows) => [...rows, emptyLine()]);
  }

  removeEditLine(index: number): void {
    this.editLines.update((rows) => (rows.length > 1 ? rows.filter((_, i) => i !== index) : rows));
  }

  saveEdit(): void {
    const current = this.request();
    if (!current || current.id === undefined) return;

    const validLines = this.editLines().filter((l) => l.itemId !== null && l.quantityRequested && l.quantityRequested > 0);
    if (validLines.length === 0) {
      this.errorMessage.set('At least one complete line item (item, quantity) is required.');
      return;
    }

    this.saving.set(true);
    this.errorMessage.set(null);

    const body: MaterialRequestUpdateRequest = {
      dateNeeded: this.editDateNeeded() || undefined,
      notes: this.editNotes().trim() || undefined,
      lines: validLines.map(
        (l): MaterialRequestLineItemRequest => ({
          itemId: l.itemId!,
          quantityRequested: l.quantityRequested!,
          notes: l.notes.trim() || undefined,
        }),
      ),
    };

    this.materialRequestsService.update1(current.id, body).subscribe({
      next: (updated) => {
        this.request.set(updated);
        this.saving.set(false);
        this.mode.set('view');
      },
      error: (err) => {
        this.saving.set(false);
        if (err?.status === 422) {
          this.errorMessage.set('This request can no longer be edited — it has already been partially or fully fulfilled.');
          this.mode.set('view');
          // The lock happened after this page loaded (someone else
          // submitted a fulfilling transfer batch in the meantime) —
          // refetch so the displayed status and Edit button reflect that.
          this.loadRequest(current.id!);
        } else if (err?.status === 404) {
          this.errorMessage.set('One of the items in this request could not be found.');
        } else {
          this.errorMessage.set('Could not save changes. Please check the line items and try again.');
        }
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

  private loadItems(onLoaded?: () => void): void {
    this.itemsService.listItems(undefined, true, undefined, 0, 300, undefined).subscribe({
      next: (result) => {
        this.items.set(result.content ?? []);
        this.itemsLoaded.set(true);
        onLoaded?.();
      },
    });
  }

  private loadRequest(id: number): void {
    this.loading.set(true);
    this.materialRequestsService.getById1(id).subscribe({
      next: (request) => {
        this.request.set(request);
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set('Material request not found.');
        this.loading.set(false);
      },
    });
  }
}
