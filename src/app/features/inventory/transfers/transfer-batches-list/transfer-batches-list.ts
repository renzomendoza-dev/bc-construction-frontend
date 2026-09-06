import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { TransferBatchResponse, TransferBatchesService } from '../../../../generated';
import { CurrentUserService } from '../../../../core/services/current-user';
import { Permission } from '../../../../core/constants/permissions';

const PAGE_SIZE = 8;
// TransferBatchesService.search supports server-side status/warehouse
// filtering, but fetching one large batch and filtering/paginating
// client-side matches the interaction pattern already used by every other
// list page in this app (Purchase Receipts, Suppliers, Warehouses, Stock).
const FETCH_SIZE = 300;

type StatusFilter = 'all' | TransferBatchResponse.StatusEnum;

@Component({
  selector: 'app-transfer-batches-list',
  imports: [DatePipe],
  templateUrl: './transfer-batches-list.html',
  styleUrl: './transfer-batches-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TransferBatchesListComponent implements OnInit {
  private readonly transferBatchesService = inject(TransferBatchesService);
  private readonly router = inject(Router);
  private readonly currentUser = inject(CurrentUserService);

  readonly canCreate = this.currentUser.hasPermission(Permission.TransferBatchCreate);

  private readonly allBatches = signal<TransferBatchResponse[]>([]);
  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly statusFilter = signal<StatusFilter>('all');
  readonly warehouseFilter = signal('all');
  readonly page = signal(1);

  // Matches either side of the transfer — lets you find every batch that
  // touched a given site or warehouse, not just as origin or destination.
  readonly warehouseNames = computed(() =>
    Array.from(
      new Set(
        this.allBatches().flatMap((b) => [b.originWarehouseName, b.destinationWarehouseName]).filter((n): n is string => !!n),
      ),
    ).sort(),
  );

  readonly filtered = computed(() => {
    const status = this.statusFilter();
    const warehouse = this.warehouseFilter();
    return this.allBatches().filter((b) => {
      if (status !== 'all' && b.status !== status) return false;
      if (warehouse !== 'all' && b.originWarehouseName !== warehouse && b.destinationWarehouseName !== warehouse) return false;
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
    this.fetchBatches();
  }

  onStatusFilterChange(value: StatusFilter): void {
    this.statusFilter.set(value);
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

  openBatch(id: number | undefined): void {
    if (id === undefined) return;
    this.router.navigate(['/inventory/transfers', id]);
  }

  createNew(): void {
    this.router.navigate(['/inventory/transfers/new']);
  }

  statusLabel(batch: TransferBatchResponse): string {
    switch (batch.status) {
      case TransferBatchResponse.StatusEnum.Draft:
        return 'Draft';
      case TransferBatchResponse.StatusEnum.Submitted:
        return 'Submitted';
      case TransferBatchResponse.StatusEnum.Completed:
        return 'Completed';
      case TransferBatchResponse.StatusEnum.AwaitingPurchase:
        return 'Awaiting Purchase';
      default:
        return '—';
    }
  }

  private fetchBatches(): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    this.transferBatchesService.search4(undefined, undefined, undefined, 0, FETCH_SIZE, undefined).subscribe({
      next: (result) => {
        this.allBatches.set((result.content ?? []) as TransferBatchResponse[]);
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set('Could not load transfer batches. Please try again.');
        this.loading.set(false);
      },
    });
  }
}
