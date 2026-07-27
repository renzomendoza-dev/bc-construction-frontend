import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { PurchaseReceiptResponse, PurchaseReceiptsService } from '../../../../generated';
import { formatPeso } from '../../../../core/model.currency';

const PAGE_SIZE = 5;
// GET /api/purchase-receipts has no warehouseId or status filter — only
// supplierId and a date range. Status and warehouse filtering happen
// client-side over this fetched batch instead. Revisit with real
// server-side filtering if receipt volume grows past a single fetch.
const FETCH_SIZE = 300;

type StatusFilter = 'all' | 'draft' | 'confirmed';

@Component({
  selector: 'app-purchase-receipts-list',
  imports: [],
  templateUrl: './purchase-receipts-list.html',
  styleUrl: './purchase-receipts-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PurchaseReceiptsListComponent implements OnInit {
  private readonly receiptsService = inject(PurchaseReceiptsService);
  private readonly router = inject(Router);

  readonly formatPeso = formatPeso;

  private readonly allReceipts = signal<PurchaseReceiptResponse[]>([]);
  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly statusFilter = signal<StatusFilter>('all');
  readonly supplierFilter = signal('all');
  readonly warehouseFilter = signal('all');
  readonly page = signal(1);

  // Derived straight from the fetched receipts' own supplierName/warehouseName
  // fields — no separate Suppliers/Warehouses API calls needed for the
  // filter dropdowns.
  readonly supplierNames = computed(() =>
    Array.from(new Set(this.allReceipts().map((r) => r.supplierName).filter((n): n is string => !!n))).sort(),
  );
  readonly warehouseNames = computed(() =>
    Array.from(new Set(this.allReceipts().map((r) => r.warehouseName).filter((n): n is string => !!n))).sort(),
  );

  readonly filtered = computed(() => {
    const status = this.statusFilter();
    const supplier = this.supplierFilter();
    const warehouse = this.warehouseFilter();
    return this.allReceipts().filter((r) => {
      const isConfirmed = !!r.confirmed;
      if (status === 'draft' && isConfirmed) return false;
      if (status === 'confirmed' && !isConfirmed) return false;
      if (supplier !== 'all' && r.supplierName !== supplier) return false;
      if (warehouse !== 'all' && r.warehouseName !== warehouse) return false;
      return true;
    });
  });

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.filtered().length / PAGE_SIZE)));
  readonly currentPage = computed(() => Math.min(this.page(), this.totalPages()));
  readonly pageItems = computed(() => {
    const start = (this.currentPage() - 1) * PAGE_SIZE;
    return this.filtered().slice(start, start + PAGE_SIZE);
  });
  readonly hasResults = computed(() => this.filtered().length > 0);
  readonly pageSummary = computed(() => {
    const total = this.filtered().length;
    if (total === 0) return '';
    const start = (this.currentPage() - 1) * PAGE_SIZE + 1;
    const end = Math.min(this.currentPage() * PAGE_SIZE, total);
    return `Showing ${start}–${end} of ${total}`;
  });

  ngOnInit(): void {
    this.fetchReceipts();
  }

  onStatusFilterChange(value: StatusFilter): void {
    this.statusFilter.set(value);
    this.page.set(1);
  }

  onSupplierFilterChange(value: string): void {
    this.supplierFilter.set(value);
    this.page.set(1);
  }

  onWarehouseFilterChange(value: string): void {
    this.warehouseFilter.set(value);
    this.page.set(1);
  }

  prevPage(): void {
    this.page.update((p) => Math.max(1, p - 1));
  }

  nextPage(): void {
    this.page.update((p) => Math.min(this.totalPages(), p + 1));
  }

  openReceipt(id: number | undefined): void {
    if (id === undefined) return;
    this.router.navigate(['/inventory/purchase-receipts', id]);
  }

  createNew(): void {
    this.router.navigate(['/inventory/purchase-receipts/new']);
  }

  receiptTotal(receipt: PurchaseReceiptResponse): number {
    return receipt.totalAmount ?? (receipt.lines ?? []).reduce((sum, l) => sum + (l.lineTotal ?? 0), 0);
  }

  statusLabel(receipt: PurchaseReceiptResponse): string {
    return receipt.confirmed ? 'Confirmed' : 'Draft';
  }

  private fetchReceipts(): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    this.receiptsService.listPurchaseReceipts(undefined, undefined, undefined, 0, FETCH_SIZE, undefined).subscribe({
      next: (result) => {
        this.allReceipts.set(result.content ?? []);
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set('Could not load purchase receipts. Please try again.');
        this.loading.set(false);
      },
    });
  }
}