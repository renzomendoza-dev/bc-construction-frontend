import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { EquipmentAssignmentBatchResponse, EquipmentAssignmentBatchesService } from '../../../generated';
import { CurrentUserService } from '../../../core/services/current-user';
import { Permission } from '../../../core/constants/permissions';

@Component({
  selector: 'app-equipment-assignment-batch-detail',
  imports: [DatePipe],
  templateUrl: './equipment-assignment-batch-detail.html',
  styleUrl: './equipment-assignment-batch-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EquipmentAssignmentBatchDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly batchesService = inject(EquipmentAssignmentBatchesService);
  private readonly currentUser = inject(CurrentUserService);

  // The backend prompt for this feature asked to be told the exact
  // @PreAuthorize strings for creating/submitting a batch, and that answer
  // hasn't come back yet — rather than invent a new unverified permission
  // constant, this reuses the already-confirmed single-item Checkout/Checkin
  // permissions, matched to the batch's own direction (assign ~ checkout,
  // return ~ checkin), since submit() delegates to that same underlying
  // logic per line.
  private readonly hasCheckoutPermission = this.currentUser.hasPermission(Permission.EquipmentCheckout);
  private readonly hasCheckinPermission = this.currentUser.hasPermission(Permission.EquipmentCheckin);

  // The Equipment module's endpoints declare their response content-type as
  // `*/*` in the OpenAPI spec, so the generated client falls back to
  // `responseType: 'blob'`. Forcing the Accept header routes it back onto
  // the JSON parsing path — same workaround as equipment-list.ts.
  private readonly jsonAccept = { httpHeaderAccept: 'application/json' } as unknown as {
    httpHeaderAccept?: '*/*';
  };

  readonly batch = signal<EquipmentAssignmentBatchResponse | null>(null);
  readonly loading = signal(true);
  readonly errorMessage = signal<string | null>(null);

  readonly confirmDialogOpen = signal(false);
  readonly submitting = signal(false);

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!id) {
      this.errorMessage.set('Invalid batch id.');
      this.loading.set(false);
      return;
    }
    this.loadBatch(id);
  }

  backToList(): void {
    this.router.navigate(['/equipment/assignment-batches']);
  }

  // A batch with holderId set goes through checkOut() per line, which now
  // covers both an assign-out (equipment was AVAILABLE) and a direct
  // site-to-site transfer (equipment was already CHECKED_OUT/IN_USE) — the
  // response doesn't disambiguate which sub-case it was, so this only tells
  // us "uses checkOut" vs "uses checkIn", not "assign" vs "transfer".
  usesCheckOut(batch: EquipmentAssignmentBatchResponse): boolean {
    return !!batch.holderId;
  }

  canSubmit(batch: EquipmentAssignmentBatchResponse): boolean {
    return this.usesCheckOut(batch) ? this.hasCheckoutPermission : this.hasCheckinPermission;
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
    this.batchesService.submit2(batchId, 'body', undefined, this.jsonAccept).subscribe({
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
            err?.error?.message ||
              'One or more pieces of equipment on this batch are no longer in a valid status for this direction.',
          );
        } else if (err?.status === 404) {
          this.errorMessage.set(err?.error?.message || 'Batch not found.');
        } else {
          this.errorMessage.set(err?.error?.message || 'Could not submit this batch. Please try again.');
        }
      },
    });
  }

  private loadBatch(id: number): void {
    this.loading.set(true);
    this.batchesService.getById4(id, 'body', undefined, this.jsonAccept).subscribe({
      next: (batch) => {
        this.batch.set(batch);
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set('Batch not found.');
        this.loading.set(false);
      },
    });
  }
}
