import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  ItemResponse,
  ItemsService,
  MaterialRequestResponse,
  MaterialRequestsService,
  TransferBatchCreateRequest,
  TransferLineItemRequest,
  TransferBatchesService,
  WarehouseResponse,
  WarehousesService,
} from '../../../../generated';

type Direction = 'PULL_OUT' | 'DISPATCH';

interface DraftLine {
  itemId: number | null;
  expectedQuantity: number | null;
  quantity: number | null;
  notes: string;
}

function emptyLine(): DraftLine {
  return { itemId: null, expectedQuantity: null, quantity: null, notes: '' };
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
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

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
    this.loadOptions();

    const fromRequestId = Number(this.route.snapshot.queryParamMap.get('fromRequestId'));
    if (fromRequestId) {
      this.loadFulfillingRequest(fromRequestId);
    }
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
    this.lines.update((rows) =>
      rows.map((r, i) => (i === index ? { ...r, itemId: value ? Number(value) : null } : r)),
    );
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
              }),
            ),
          );
        }
      },
      error: () => {
        this.errorMessage.set('Could not load the material request to fulfill. You can still create a plain dispatch below.');
      },
    });
  }

  private loadOptions(): void {
    this.loadingOptions.set(true);

    this.warehousesService.listWarehouses(true, 0, 200, undefined).subscribe({
      next: (result) => this.warehouses.set(result.content ?? []),
      error: () => this.errorMessage.set('Could not load warehouses.'),
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
