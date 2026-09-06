import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { WorkerResponse, WorkersService } from '../../../generated';
import { formatPeso } from '../../../core/model.currency';
import { CurrentUserService } from '../../../core/services/current-user';
import { Permission } from '../../../core/constants/permissions';

const PAGE_SIZE = 8;
// Same "fetch a large batch, filter/paginate client-side" convention used
// across every list page in this app, for UX consistency even though
// search() supports server-side active filtering.
const FETCH_SIZE = 300;

type ActiveFilter = 'all' | 'active' | 'inactive';

@Component({
  selector: 'app-workers-list',
  imports: [],
  templateUrl: './workers-list.html',
  styleUrl: './workers-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkersListComponent implements OnInit {
  private readonly workersService = inject(WorkersService);
  private readonly router = inject(Router);
  private readonly currentUser = inject(CurrentUserService);

  readonly formatPeso = formatPeso;
  readonly canCreate = this.currentUser.hasPermission(Permission.WorkerCreate);

  private readonly allWorkers = signal<WorkerResponse[]>([]);
  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly activeFilter = signal<ActiveFilter>('active');
  readonly page = signal(1);

  readonly filtered = computed(() => {
    const filter = this.activeFilter();
    return this.allWorkers().filter((w) => {
      if (filter === 'active') return w.active !== false;
      if (filter === 'inactive') return w.active === false;
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
    this.fetchWorkers();
  }

  onActiveFilterChange(value: ActiveFilter): void {
    this.activeFilter.set(value);
    this.page.set(1);
  }

  prevPage(): void {
    this.page.update((p) => Math.max(1, p - 1));
  }

  nextPage(): void {
    this.page.update((p) => Math.min(this.totalPages(), p + 1));
  }

  openWorker(id: number | undefined): void {
    if (id === undefined) return;
    this.router.navigate(['/workers', id]);
  }

  createNew(): void {
    this.router.navigate(['/workers/new']);
  }

  private fetchWorkers(): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    this.workersService.search(undefined, 0, FETCH_SIZE, undefined).subscribe({
      next: (result) => {
        this.allWorkers.set((result.content ?? []) as WorkerResponse[]);
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set('Could not load workers. Please try again.');
        this.loading.set(false);
      },
    });
  }
}
