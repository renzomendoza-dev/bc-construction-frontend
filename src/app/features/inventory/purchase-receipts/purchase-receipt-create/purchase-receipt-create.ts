import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  ItemResponse,
  ItemsService,
  PurchaseReceiptCreateRequest,
  PurchaseReceiptLineRequest,
  PurchaseReceiptsService,
  SupplierResponse,
  SuppliersService,
  WarehouseResponse,
  WarehousesService,
} from '../../../../generated';
import { formatPeso } from '../../../../core/model.currency';

interface DraftLine {
  itemId: number | null;
  quantity: number | null;
  unitCost: number | null;
}

function emptyLine(): DraftLine {
  return { itemId: null, quantity: null, unitCost: null };
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
  private readonly router = inject(Router);

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

  readonly total = computed(() =>
    this.lines().reduce((sum, l) => sum + (l.quantity ?? 0) * (l.unitCost ?? 0), 0),
  );

  ngOnInit(): void {
    this.loadOptions();
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
        this.errorMessage.set(
          err?.status === 422
            ? 'Every line must reference a valid, existing item.'
            : 'Could not create receipt. Please check the form and try again.',
        );
      },
    });
  }

  private loadOptions(): void {
    this.loadingOptions.set(true);

    this.suppliersService.listSuppliers(true, 0, 200, undefined).subscribe({
      next: (result) => this.suppliers.set(result.content ?? []),
      error: () => this.errorMessage.set('Could not load suppliers.'),
    });

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