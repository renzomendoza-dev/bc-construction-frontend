import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import {
  ItemResponse,
  ItemsService,
  PurchaseOrderResponse,
  PurchaseOrdersService,
  PurchaseReceiptCreateRequest,
  PurchaseReceiptLineRequest,
  PurchaseReceiptsService,
  SupplierResponse,
  SuppliersService,
  TransferBatchResponse,
  TransferBatchesService,
  WarehouseResponse,
  WarehousesService,
} from '../../../../generated';
import { formatPeso } from '../../../../core/model.currency';

interface DraftLine {
  itemId: number | null;
  quantity: number | null;
  unitCost: number | null;
  // True for a line pre-filled from a fulfilling TransferBatch shortfall or
  // PurchaseOrder — its item is shown as locked text instead of a <select>.
  // Same rationale as transfer-batch-create.ts's DraftLine.fromRequest: a
  // native <select>'s [value] binding isn't reliable for a row that didn't
  // exist in the DOM until the source loaded, and the item isn't meant to
  // change here anyway.
  locked: boolean;
}

function emptyLine(): DraftLine {
  return { itemId: null, quantity: null, unitCost: null, locked: false };
}

@Component({
  selector: 'app-purchase-receipt-create',
  imports: [],
  templateUrl: './purchase-receipt-create.html',
  styleUrl: './purchase-receipt-create.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PurchaseReceiptCreateComponent implements OnInit {
  private readonly receiptsService = inject(PurchaseReceiptsService);
  private readonly suppliersService = inject(SuppliersService);
  private readonly warehousesService = inject(WarehousesService);
  private readonly itemsService = inject(ItemsService);
  private readonly transferBatchesService = inject(TransferBatchesService);
  private readonly purchaseOrdersService = inject(PurchaseOrdersService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly formatPeso = formatPeso;

  readonly suppliers = signal<SupplierResponse[]>([]);
  readonly warehouses = signal<WarehouseResponse[]>([]);
  readonly items = signal<ItemResponse[]>([]);
  readonly loadingOptions = signal(true);

  readonly supplierId = signal<number | null>(null);
  readonly warehouseId = signal<number | null>(null);
  readonly receiptNumber = signal('');
  readonly purchaseDate = signal(new Date().toISOString().slice(0, 10));
  readonly notes = signal('');
  readonly lines = signal<DraftLine[]>([emptyLine()]);

  readonly saving = signal(false);
  readonly errorMessage = signal<string | null>(null);

  // Set when arriving via "Create Purchase Receipt for this Shortfall" on a
  // blocked (AWAITING_PURCHASE) TransferBatch's detail page
  // (?fulfillsTransferBatchId=). Confirming this receipt later flips that
  // batch back to DRAFT so it can be resubmitted.
  readonly fulfillsTransferBatchId = signal<number | null>(null);
  readonly fulfillingBatch = signal<TransferBatchResponse | null>(null);

  // Set when arriving via "Receive Against This Order" on a Purchase Order's
  // detail page (?purchaseOrderId=). Confirming this receipt updates that
  // order's status to PARTIALLY_RECEIVED or RECEIVED — independent of
  // fulfillsTransferBatchId, a receipt can carry either, both, or neither.
  readonly purchaseOrderId = signal<number | null>(null);
  readonly fulfillingOrder = signal<PurchaseOrderResponse | null>(null);

  readonly total = computed(() =>
    this.lines().reduce((sum, l) => sum + (l.quantity ?? 0) * (l.unitCost ?? 0), 0),
  );

  ngOnInit(): void {
    const batchId = Number(this.route.snapshot.queryParamMap.get('fulfillsTransferBatchId'));
    const orderId = Number(this.route.snapshot.queryParamMap.get('purchaseOrderId'));
    this.loadOptions(batchId || null, orderId || null);
  }

  backToList(): void {
    this.router.navigate(['/inventory/purchase-receipts']);
  }

  itemName(itemId: number | null): string {
    return this.items().find((i) => i.id === itemId)?.name ?? '';
  }

  lineTotal(line: DraftLine): number {
    return (line.quantity ?? 0) * (line.unitCost ?? 0);
  }

  onSupplierChange(value: string): void {
    this.supplierId.set(value ? Number(value) : null);
  }

  onWarehouseChange(value: string): void {
    this.warehouseId.set(value ? Number(value) : null);
  }

  onReceiptNumberChange(value: string): void {
    this.receiptNumber.set(value);
  }

  onPurchaseDateChange(value: string): void {
    this.purchaseDate.set(value);
  }

  onNotesChange(value: string): void {
    this.notes.set(value);
  }

  // Excludes items already picked on other lines, so the same item can't be
  // added twice — the current line's own selection is excluded only from
  // every *other* line's options, so it still shows as selected there.
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
    this.lines.update((rows) =>
      rows.map((r, i) => (i === index ? { ...r, itemId: value ? Number(value) : null } : r)),
    );
  }

  onLineQtyChange(index: number, value: string): void {
    this.lines.update((rows) =>
      rows.map((r, i) => (i === index ? { ...r, quantity: value === '' ? null : Number(value) } : r)),
    );
  }

  onLineCostChange(index: number, value: string): void {
    this.lines.update((rows) =>
      rows.map((r, i) => (i === index ? { ...r, unitCost: value === '' ? null : Number(value) } : r)),
    );
  }

  addLine(): void {
    this.lines.update((rows) => [...rows, emptyLine()]);
  }

  removeLine(index: number): void {
    this.lines.update((rows) => (rows.length > 1 ? rows.filter((_, i) => i !== index) : rows));
  }

  createReceipt(): void {
    const supplierId = this.supplierId();
    const warehouseId = this.warehouseId();
    const purchaseDate = this.purchaseDate();
    const validLines = this.lines().filter((l) => l.itemId !== null && l.quantity && l.unitCost !== null);

    if (!supplierId || !warehouseId || !purchaseDate) {
      this.errorMessage.set('Supplier, warehouse, and purchase date are required.');
      return;
    }
    if (validLines.length === 0) {
      this.errorMessage.set('At least one complete line item (item, quantity, unit cost) is required.');
      return;
    }

    this.saving.set(true);
    this.errorMessage.set(null);

    const body: PurchaseReceiptCreateRequest = {
      supplierId,
      warehouseId,
      purchaseDate,
      receiptNumber: this.receiptNumber().trim() || undefined,
      notes: this.notes().trim() || undefined,
      fulfillsTransferBatchId: this.fulfillsTransferBatchId() ?? undefined,
      purchaseOrderId: this.purchaseOrderId() ?? undefined,
      lines: validLines.map(
        (l): PurchaseReceiptLineRequest => ({
          itemId: l.itemId!,
          quantity: l.quantity!,
          unitCost: l.unitCost!,
        }),
      ),
    };

    this.receiptsService.createPurchaseReceipt(body).subscribe({
      next: (created) => {
        this.saving.set(false);
        this.router.navigate(['/inventory/purchase-receipts', created.id]);
      },
      error: (err) => {
        this.saving.set(false);
        // 422 now covers three distinct causes (no lines / invalid item /
        // the linked batch is no longer AWAITING_PURCHASE) — surface the
        // backend's own message rather than guess which one applies.
        this.errorMessage.set(
          err?.error?.message ||
            (err?.status === 404
              ? 'Supplier, warehouse, or the transfer batch being fulfilled could not be found.'
              : 'Could not create receipt. Please check the form and try again.'),
        );
      },
    });
  }

  private loadFulfillingBatch(batchId: number): void {
    this.transferBatchesService.getById2(batchId).subscribe({
      next: (batch) => {
        this.fulfillingBatch.set(batch);
        this.fulfillsTransferBatchId.set(batch.id ?? null);
        // The shortfall happened at the batch's origin — that's the
        // warehouse this purchase needs to land in.
        this.warehouseId.set(batch.originWarehouseId ?? null);

        const batchLines = batch.lines ?? [];
        if (batchLines.length > 0) {
          this.lines.set(
            batchLines.map(
              (l): DraftLine => ({
                itemId: l.itemId ?? null,
                quantity: l.quantity ?? null,
                unitCost: null,
                locked: true,
              }),
            ),
          );
        }
      },
      error: () => {
        this.errorMessage.set('Could not load the transfer batch to fulfill. You can still create a plain receipt below.');
      },
    });
  }

  // Pre-fills supplier + remaining line items from a Purchase Order being
  // (at least partially) received against. Only lines with quantity still
  // outstanding are included — a line already fully received by prior
  // receipts against this order has nothing left to receive.
  private loadFulfillingOrder(orderId: number): void {
    this.purchaseOrdersService.getById(orderId).subscribe({
      next: (order) => {
        this.fulfillingOrder.set(order);
        this.purchaseOrderId.set(order.id ?? null);
        this.supplierId.set(order.supplierId ?? null);

        const outstandingLines = (order.lines ?? []).filter(
          (l) => (l.receivedQuantity ?? 0) < (l.quantity ?? 0),
        );
        if (outstandingLines.length > 0) {
          this.lines.set(
            outstandingLines.map(
              (l): DraftLine => ({
                itemId: l.itemId ?? null,
                quantity: (l.quantity ?? 0) - (l.receivedQuantity ?? 0),
                unitCost: null,
                locked: true,
              }),
            ),
          );
        }
      },
      error: () => {
        this.errorMessage.set('Could not load the purchase order to receive against. You can still create a plain receipt below.');
      },
    });
  }

  // Loads suppliers/warehouses/items and only *then* applies the
  // fulfilling-batch pre-fill (if any) — see the comment on the equivalent
  // method in transfer-batch-create.ts for why the ordering matters: a
  // native <select>'s [value] binding silently fails to select an <option>
  // that doesn't exist in the DOM yet, and Angular won't retry once it does.
  private loadOptions(fulfillsBatchId: number | null, purchaseOrderId: number | null): void {
    this.loadingOptions.set(true);

    this.suppliersService.listSuppliers(true, 0, 200, undefined).subscribe({
      next: (result) => this.suppliers.set(result.content ?? []),
      error: () => this.errorMessage.set('Could not load suppliers.'),
    });

    forkJoin({
      warehouses: this.warehousesService.listWarehouses(true, 0, 200, undefined),
      items: this.itemsService.listItems(undefined, true, undefined, 0, 300, undefined),
    }).subscribe({
      next: ({ warehouses, items }) => {
        this.warehouses.set(warehouses.content ?? []);
        this.items.set(items.content ?? []);
        this.loadingOptions.set(false);
        if (fulfillsBatchId) {
          this.loadFulfillingBatch(fulfillsBatchId);
        }
        if (purchaseOrderId) {
          this.loadFulfillingOrder(purchaseOrderId);
        }
      },
      error: () => {
        this.errorMessage.set('Could not load warehouses or items.');
        this.loadingOptions.set(false);
      },
    });
  }
}