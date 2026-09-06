import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  PurchaseReceiptResponse,
  PurchaseReceiptsService,
  TransferBatchResponse,
  TransferBatchesService,
} from '../../../../generated';
import { CurrentUserService } from '../../../../core/services/current-user';
import { Permission } from '../../../../core/constants/permissions';

@Component({
  selector: 'app-transfer-batch-detail',
  imports: [DatePipe, RouterLink],
  templateUrl: './transfer-batch-detail.html',
  styleUrl: './transfer-batch-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TransferBatchDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly transferBatchesService = inject(TransferBatchesService);
  private readonly purchaseReceiptsService = inject(PurchaseReceiptsService);
  private readonly currentUser = inject(CurrentUserService);

  readonly canSubmit = this.currentUser.hasPermission(Permission.TransferBatchSubmit);
  readonly canDelete = this.currentUser.hasPermission(Permission.TransferBatchDelete);

  readonly batch = signal<TransferBatchResponse | null>(null);
  readonly loading = signal(true);
  readonly errorMessage = signal<string | null>(null);

  readonly confirmDialogOpen = signal(false);
  readonly submitting = signal(false);

  readonly deleteDialogOpen = signal(false);
  readonly deleting = signal(false);

  // Only populated while the batch is AWAITING_PURCHASE — lets the banner
  // link straight to an already-created receipt instead of prompting to
  // create a duplicate one.
  readonly linkedReceipt = signal<PurchaseReceiptResponse | null>(null);
  readonly linkedReceiptChecked = signal(false);

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
      case TransferBatchResponse.StatusEnum.AwaitingPurchase:
        return 'Awaiting Purchase';
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
    const batchId = current.id;

    this.submitting.set(true);
    this.transferBatchesService.submit1(batchId).subscribe({
      next: (updated) => {
        this.batch.set(updated);
        this.submitting.set(false);
        this.confirmDialogOpen.set(false);
      },
      error: (err) => {
        this.submitting.set(false);
        this.confirmDialogOpen.set(false);
        if (err?.status === 409) {
          this.errorMessage.set(
            'Insufficient stock at the origin to cover one or more lines. This batch is now Awaiting Purchase — create a Purchase Receipt for the shortfall, then resubmit.',
          );
          // The 409 also sets the batch to AWAITING_PURCHASE server-side —
          // refetch so the page reflects that instead of looking like the
          // submit silently did nothing.
          this.loadBatch(batchId);
        } else if (err?.status === 400) {
          this.errorMessage.set('This batch has no lines, or an item/warehouse on one of its lines has since become inactive.');
        } else if (err?.status === 404) {
          // Not just "batch not found" — the backend also returns 404 when
          // an origin item+warehouse has no InventoryStock row at all yet
          // (distinct from "insufficient stock", which is the 409 case
          // above). That specific case isn't in the endpoint's documented
          // responses, so surface the backend's own message rather than a
          // generic one that would hide what's actually wrong.
          this.errorMessage.set(err?.error?.message || 'Transfer batch not found.');
        } else {
          this.errorMessage.set(err?.error?.message || 'Could not submit this transfer. Please try again.');
        }
      },
    });
  }

  openDeleteDialog(): void {
    this.deleteDialogOpen.set(true);
  }

  closeDeleteDialog(): void {
    this.deleteDialogOpen.set(false);
  }

  deleteBatch(): void {
    const current = this.batch();
    if (!current || current.id === undefined) return;
    const batchId = current.id;

    this.deleting.set(true);
    this.transferBatchesService.delete2(batchId).subscribe({
      next: () => {
        this.deleting.set(false);
        this.router.navigate(['/inventory/transfers']);
      },
      error: (err) => {
        this.deleting.set(false);
        this.deleteDialogOpen.set(false);
        if (err?.status === 422) {
          this.errorMessage.set('This batch is no longer a draft, so it can no longer be deleted.');
          this.loadBatch(batchId);
        } else if (err?.status === 404) {
          this.errorMessage.set('Transfer batch not found.');
        } else {
          this.errorMessage.set(err?.error?.message || 'Could not delete this batch. Please try again.');
        }
      },
    });
  }

  private loadBatch(id: number): void {
    this.loading.set(true);
    this.transferBatchesService.getById3(id).subscribe({
      next: (batch) => {
        this.batch.set(batch);
        this.loading.set(false);
        if (batch.status === TransferBatchResponse.StatusEnum.AwaitingPurchase) {
          this.checkLinkedReceipt(id);
        }
      },
      error: () => {
        this.errorMessage.set('Transfer batch not found.');
        this.loading.set(false);
      },
    });
  }

  private checkLinkedReceipt(batchId: number): void {
    this.linkedReceiptChecked.set(false);
    this.purchaseReceiptsService.listPurchaseReceipts(undefined, undefined, undefined, batchId, 0, 1, undefined).subscribe({
      next: (result) => {
        const receipts = (result.content ?? []) as PurchaseReceiptResponse[];
        this.linkedReceipt.set(receipts[0] ?? null);
        this.linkedReceiptChecked.set(true);
      },
      error: () => {
        this.linkedReceiptChecked.set(true);
      },
    });
  }
}
