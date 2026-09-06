import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { PurchaseOrderResponse, PurchaseOrdersService } from '../../../../generated';
import { CurrentUserService } from '../../../../core/services/current-user';
import { Permission } from '../../../../core/constants/permissions';

const PAGE_SIZE = 8;
// Same "fetch a large batch, filter/paginate client-side" convention used
// across every list page in this app, for UX consistency even though
// search() supports server-side supplierId/status filters.
const FETCH_SIZE = 300;

type StatusFilter = 'all' | PurchaseOrderResponse.StatusEnum;

@Component({
  selector: 'app-purchase-orders-list',
  imports: [DatePipe],
  templateUrl: './purchase-orders-list.html',
  styleUrl: './purchase-orders-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PurchaseOrdersListComponent implements OnInit {
  private readonly ordersService = inject(PurchaseOrdersService);
  private readonly router = inject(Router);
  private readonly currentUser = inject(CurrentUserService);

  readonly canCreate = this.currentUser.hasPermission(Permission.PurchaseOrderCreate);

  private readonly allOrders = signal<PurchaseOrderResponse[]>([]);
  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly statusFilter = signal<StatusFilter>('all');
  readonly supplierFilter = signal('all');
  readonly page = signal(1);

  readonly supplierNames = computed(() =>
    Array.from(new Set(this.allOrders().map((o) => o.supplierName).filter((n): n is string => !!n))).sort(),
  );

  readonly filtered = computed(() => {
    const status = this.statusFilter();
    const supplier = this.supplierFilter();
    return this.allOrders().filter((o) => {
      if (status !== 'all' && o.status !== status) return false;
      if (supplier !== 'all' && o.supplierName !== supplier) return false;
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
    this.fetchOrders();
  }

  onStatusFilterChange(value: StatusFilter): void {
    this.statusFilter.set(value);
    this.page.set(1);
  }

  onSupplierFilterChange(value: string): void {
    this.supplierFilter.set(value);
    this.page.set(1);
  }

  prevPage(): void {
    this.page.update((p) => Math.max(1, p - 1));
  }

  nextPage(): void {
    this.page.update((p) => Math.min(this.totalPages(), p + 1));
  }

  openOrder(id: number | undefined): void {
    if (id === undefined) return;
    this.router.navigate(['/inventory/purchase-orders', id]);
  }

  createNew(): void {
    this.router.navigate(['/inventory/purchase-orders/new']);
  }

  lineCount(order: PurchaseOrderResponse): number {
    return (order.lines ?? []).length;
  }

  statusLabel(order: PurchaseOrderResponse): string {
    switch (order.status) {
      case PurchaseOrderResponse.StatusEnum.Draft:
        return 'Draft';
      case PurchaseOrderResponse.StatusEnum.Submitted:
        return 'Submitted';
      case PurchaseOrderResponse.StatusEnum.PartiallyReceived:
        return 'Partially Received';
      case PurchaseOrderResponse.StatusEnum.Received:
        return 'Received';
      case PurchaseOrderResponse.StatusEnum.Closed:
        return 'Closed';
      default:
        return '—';
    }
  }

  private fetchOrders(): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    this.ordersService.search1(undefined, undefined, 0, FETCH_SIZE, undefined).subscribe({
      next: (result) => {
        this.allOrders.set((result.content ?? []) as PurchaseOrderResponse[]);
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set('Could not load purchase orders. Please try again.');
        this.loading.set(false);
      },
    });
  }
}
