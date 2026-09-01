import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { EquipmentAssignmentBatchResponse, EquipmentAssignmentBatchesService } from '../../../generated';
import { CurrentUserService } from '../../../core/services/current-user';
import { Permission } from '../../../core/constants/permissions';

const PAGE_SIZE = 8;

type StatusFilter = 'all' | EquipmentAssignmentBatchResponse.StatusEnum;

@Component({
  selector: 'app-equipment-assignment-batches-list',
  imports: [DatePipe],
  templateUrl: './equipment-assignment-batches-list.html',
  styleUrl: './equipment-assignment-batches-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EquipmentAssignmentBatchesListComponent implements OnInit {
  private readonly batchesService = inject(EquipmentAssignmentBatchesService);
  private readonly router = inject(Router);
  private readonly currentUser = inject(CurrentUserService);

  // See equipment-assignment-batch-detail.ts for why this reuses the
  // existing single-item Checkout/Checkin permissions rather than a new,
  // unverified batch-specific one.
  readonly canCreate =
    this.currentUser.hasPermission(Permission.EquipmentCheckout) ||
    this.currentUser.hasPermission(Permission.EquipmentCheckin);

  // The Equipment module's endpoints declare their response content-type as
  // `*/*` in the OpenAPI spec, so the generated client falls back to
  // `responseType: 'blob'`. Forcing the Accept header routes it back onto
  // the JSON parsing path — same workaround as equipment-list.ts.
  private readonly jsonAccept = { httpHeaderAccept: 'application/json' } as unknown as {
    httpHeaderAccept?: '*/*';
  };

  private readonly allBatches = signal<EquipmentAssignmentBatchResponse[]>([]);
  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly statusFilter = signal<StatusFilter>('all');
  readonly page = signal(1);

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.allBatches().length / PAGE_SIZE)));
  readonly currentPage = computed(() => Math.min(this.page(), this.totalPages()));
  readonly pageItems = computed(() => {
    const start = (this.currentPage() - 1) * PAGE_SIZE;
    return this.allBatches().slice(start, start + PAGE_SIZE);
  });
  readonly hasResults = computed(() => this.allBatches().length > 0);
  readonly pageSummary = computed(() => {
    const total = this.allBatches().length;
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
    this.fetchBatches();
  }

  prevPage(): void {
    this.page.update((p) => Math.max(1, p - 1));
  }

  nextPage(): void {
    this.page.update((p) => Math.min(this.totalPages(), p + 1));
  }

  openBatch(id: number | undefined): void {
    if (id === undefined) return;
    this.router.navigate(['/equipment/assignment-batches', id]);
  }

  createNew(): void {
    this.router.navigate(['/equipment/assignment-batches/new']);
  }

  // A batch with holderId set goes through checkOut() per line, which now
  // covers both an assign-out and a direct site-to-site transfer — the
  // response doesn't disambiguate which sub-case it was.
  directionLabel(batch: EquipmentAssignmentBatchResponse): string {
    return batch.holderId ? 'Send' : 'Return';
  }

  statusLabel(batch: EquipmentAssignmentBatchResponse): string {
    switch (batch.status) {
      case EquipmentAssignmentBatchResponse.StatusEnum.Draft:
        return 'Draft';
      case EquipmentAssignmentBatchResponse.StatusEnum.Submitted:
        return 'Submitted';
      case EquipmentAssignmentBatchResponse.StatusEnum.Completed:
        return 'Completed';
      default:
        return '—';
    }
  }

  private fetchBatches(): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    const filter = this.statusFilter();
    const status = filter === 'all' ? undefined : filter;
    this.batchesService.findAll1(status, 'body', undefined, this.jsonAccept).subscribe({
      next: (result) => {
        this.allBatches.set(result ?? []);
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set('Could not load equipment assignment batches. Please try again.');
        this.loading.set(false);
      },
    });
  }
}
