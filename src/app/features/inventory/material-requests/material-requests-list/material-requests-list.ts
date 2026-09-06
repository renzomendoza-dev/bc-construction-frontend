import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MaterialRequestResponse, MaterialRequestsService } from '../../../../generated';
import { CurrentUserService } from '../../../../core/services/current-user';
import { Permission } from '../../../../core/constants/permissions';

const PAGE_SIZE = 8;
// Same "fetch a large batch, filter/paginate client-side" pattern used by
// every other list page in this app, even though search1() also supports
// server-side siteWarehouseId/status filtering.
const FETCH_SIZE = 300;

type StatusFilter = 'all' | MaterialRequestResponse.StatusEnum;

@Component({
  selector: 'app-material-requests-list',
  imports: [],
  templateUrl: './material-requests-list.html',
  styleUrl: './material-requests-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MaterialRequestsListComponent implements OnInit {
  private readonly materialRequestsService = inject(MaterialRequestsService);
  private readonly router = inject(Router);
  private readonly currentUser = inject(CurrentUserService);

  readonly canCreate = this.currentUser.hasPermission(Permission.MaterialRequestCreate);

  private readonly allRequests = signal<MaterialRequestResponse[]>([]);
  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly statusFilter = signal<StatusFilter>('all');
  readonly siteFilter = signal('all');
  readonly page = signal(1);

  readonly siteNames = computed(() =>
    Array.from(new Set(this.allRequests().map((r) => r.siteWarehouseName).filter((n): n is string => !!n))).sort(),
  );

  readonly filtered = computed(() => {
    const status = this.statusFilter();
    const site = this.siteFilter();
    return this.allRequests().filter((r) => {
      if (status !== 'all' && r.status !== status) return false;
      if (site !== 'all' && r.siteWarehouseName !== site) return false;
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
    this.fetchRequests();
  }

  onStatusFilterChange(value: StatusFilter): void {
    this.statusFilter.set(value);
    this.page.set(1);
  }

  onSiteFilterChange(value: string): void {
    this.siteFilter.set(value);
    this.page.set(1);
  }

  prevPage(): void {
    this.page.update((p) => Math.max(1, p - 1));
  }

  nextPage(): void {
    this.page.update((p) => Math.min(this.totalPages(), p + 1));
  }

  openRequest(id: number | undefined): void {
    if (id === undefined) return;
    this.router.navigate(['/inventory/material-requests', id]);
  }

  createNew(): void {
    this.router.navigate(['/inventory/material-requests/new']);
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

  private fetchRequests(): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    this.materialRequestsService.search4(undefined, undefined, 0, FETCH_SIZE, undefined).subscribe({
      next: (result) => {
        this.allRequests.set((result.content ?? []) as MaterialRequestResponse[]);
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set('Could not load material requests. Please try again.');
        this.loading.set(false);
      },
    });
  }
}
