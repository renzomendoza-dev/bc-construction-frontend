import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { PurchaseReceiptResponse, PurchaseReceiptsService } from '../../../../generated';
import { formatPeso } from '../../../../core/model.currency';


@Component({
  selector: 'app-purchase-receipt-detail',
  imports: [DatePipe],
  templateUrl: './purchase-receipt-detail.html',
  styleUrl: './purchase-receipt-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PurchaseReceiptDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly receiptsService = inject(PurchaseReceiptsService);

  readonly formatPeso = formatPeso;

  readonly receipt = signal<PurchaseReceiptResponse | null>(null);
  readonly loading = signal(true);
  readonly errorMessage = signal<string | null>(null);

  readonly confirmDialogOpen = signal(false);
  readonly confirming = signal(false);

  readonly imageViewerOpen = signal(false);
  readonly uploadingImage = signal(false);

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!id) {
      this.errorMessage.set('Invalid receipt id.');
      this.loading.set(false);
      return;
    }
    this.loadReceipt(id);
  }

  backToList(): void {
    this.router.navigate(['/inventory/purchase-receipts']);
  }

  lineTotal(qty: number | undefined, unitCost: number | undefined): number {
    return (qty ?? 0) * (unitCost ?? 0);
  }

  receiptTotal(receipt: PurchaseReceiptResponse): number {
    return receipt.totalAmount ?? (receipt.lines ?? []).reduce((sum, l) => sum + (l.lineTotal ?? 0), 0);
  }

  openConfirmDialog(): void {
    this.confirmDialogOpen.set(true);
  }

  closeConfirmDialog(): void {
    this.confirmDialogOpen.set(false);
  }

  confirmReceipt(): void {
    const current = this.receipt();
    if (!current || current.id === undefined) return;

    this.confirming.set(true);
    this.receiptsService.confirmPurchaseReceipt(current.id).subscribe({
      next: (updated) => {
        this.receipt.set(updated);
        this.confirming.set(false);
        this.confirmDialogOpen.set(false);
      },
      error: () => {
        this.confirming.set(false);
        this.confirmDialogOpen.set(false);
        this.errorMessage.set('Could not confirm receipt. It may already be confirmed, or an item/warehouse on it is now inactive.');
      },
    });
  }

  openImageViewer(): void {
    this.imageViewerOpen.set(true);
  }

  closeImageViewer(): void {
    this.imageViewerOpen.set(false);
  }

  onImageFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    const current = this.receipt();
    if (!file || !current || current.id === undefined) return;

    this.uploadingImage.set(true);
    this.receiptsService.uploadReceiptImage(current.id, file).subscribe({
      next: (updated) => {
        this.receipt.set(updated);
        this.uploadingImage.set(false);
        input.value = '';
      },
      error: () => {
        this.uploadingImage.set(false);
        this.errorMessage.set('Image upload failed. Please try again.');
        input.value = '';
      },
    });
  }

  private loadReceipt(id: number): void {
    this.loading.set(true);
    this.receiptsService.getPurchaseReceiptById(id).subscribe({
      next: (receipt) => {
        this.receipt.set(receipt);
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set('Purchase receipt not found.');
        this.loading.set(false);
      },
    });
  }
}