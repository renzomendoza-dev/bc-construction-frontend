import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { TransferBatchResponse, TransferBatchesService } from '../../../../generated';
import { CurrentUserService } from '../../../../core/services/current-user';
import { Permission } from '../../../../core/constants/permissions';

@Component({
  selector: 'app-transfer-batch-detail',
  imports: [DatePipe],
  templateUrl: './transfer-batch-detail.html',
  styleUrl: './transfer-batch-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TransferBatchDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly transferBatchesService = inject(TransferBatchesService);
  private readonly currentUser = inject(CurrentUserService);

  readonly canSubmit = this.currentUser.hasPermission(Permission.TransferBatchSubmit);

  readonly batch = signal<TransferBatchResponse | null>(null);
  readonly loading = signal(true);
  readonly errorMessage = signal<string | null>(null);

  readonly confirmDialogOpen = signal(false);
  readonly submitting = signal(false);

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!id) {
      this.errorMessage.set('Invalid transfer id.');
      this.loading.set(false);
      return;
    }
    this.loadBatch(id);
  }

  backToList(): void {
    this.router.navigate(['/inventory/transfers']);
  }

  statusLabel(batch: TransferBatchResponse): string {
    switch (batch.status) {
      case TransferBatchResponse.StatusEnum.Draft:
        return 'Draft';
      case TransferBatchResponse.StatusEnum.Submitted:
        return 'Submitted';
      case TransferBatchResponse.StatusEnum.Completed:
        return 'Completed';
      default:
        return '—';
    }
  }

  openConfirmDialog(): void {
    this.confirmDialogOpen.set(true);
  }

  closeConfirmDialog(): void {
    this.confirmDialogOpen.set(false);
  }

  submitBatch(): void {
    const current = this.batch();
    if (!current || current.id === undefined) return;

    this.submitting.set(true);
    this.transferBatchesService.submit(current.id).subscribe({
      next: (updated) => {
        this.batch.set(updated);
        this.submitting.set(false);
        this.confirmDialogOpen.set(false);
      },
      error: (err) => {
        this.submitting.set(false);
        this.confirmDialogOpen.set(false);
        this.errorMessage.set(
          err?.status === 409
            ? 'Insufficient stock at the origin to cover one or more lines. Adjust the quantities or stock before retrying.'
            : err?.status === 400
              ? 'This batch has no lines, or an item/warehouse on one of its lines has since become inactive.'
              : 'Could not submit this transfer. Please try again.',
        );
      },
    });
  }

  private loadBatch(id: number): void {
    this.loading.set(true);
    this.transferBatchesService.getById1(id).subscribe({
      next: (batch) => {
        this.batch.set(batch);
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set('Transfer batch not found.');
        this.loading.set(false);
      },
    });
  }
}
