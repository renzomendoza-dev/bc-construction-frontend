import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  ItemResponse,
  ItemsService,
  PurchaseOrderLineRequest,
  PurchaseOrderResponse,
  PurchaseOrderUpdateRequest,
  PurchaseOrdersService,
} from '../../../../generated';
import { CurrentUserService } from '../../../../core/services/current-user';
import { Permission } from '../../../../core/constants/permissions';

type Mode = 'view' | 'edit';

interface DraftLine {
  itemId: number | null;
  quantity: number | null;
  notes: string;
}

function emptyLine(): DraftLine {
  return { itemId: null, quantity: null, notes: '' };
}

@Component({
  selector: 'app-purchase-order-detail',
  imports: [DatePipe, RouterLink],
  templateUrl: './purchase-order-detail.html',
  styleUrl: './purchase-order-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PurchaseOrderDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly ordersService = inject(PurchaseOrdersService);
  private readonly itemsService = inject(ItemsService);
  private readonly currentUser = inject(CurrentUserService);

  readonly canEdit = this.currentUser.hasPermission(Permission.PurchaseOrderEdit);
  readonly canClose = this.currentUser.hasPermission(Permission.PurchaseOrderClose);

  readonly order = signal<PurchaseOrderResponse | null>(null);
  readonly loading = signal(true);
  readonly errorMessage = signal<string | null>(null);

  readonly submitDialogOpen = signal(false);
  readonly submitting = signal(false);

  readonly closeDialogOpen = signal(false);
  readonly closing = signal(false);

  // ---- Edit mode ----
  readonly mode = signal<Mode>('view');
  readonly items = signal<ItemResponse[]>([]);
  readonly itemsLoaded = signal(false);

  readonly editNotes = signal('');
  readonly editLines = signal<DraftLine[]>([emptyLine()]);
  readonly saving = signal(false);

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!id) {
      this.errorMessage.set('Invalid purchase order id.');
      this.loading.set(false);
      return;
    }
    this.loadOrder(id);
  }

  backToList(): void {
    this.router.navigate(['/inventory/purchase-orders']);
  }

  itemName(itemId: number | null): string {
    return this.items().find((i) => i.id === itemId)?.name ?? '';
  }

  // A line locks once every unit ordered has been received — not the order
  // as a whole, since PARTIALLY_RECEIVED can still have some lines fully
  // covered and others not.
  lineProgress(line: { quantity?: number; receivedQuantity?: number }): string {
    return `${line.receivedQuantity ?? 0} / ${line.quantity ?? 0}`;
  }

  isLineComplete(line: { quantity?: number; receivedQuantity?: number }): boolean {
    return (line.receivedQuantity ?? 0) >= (line.quantity ?? 0);
  }

  canShowEdit(order: PurchaseOrderResponse): boolean {
    return this.canEdit && order.status === PurchaseOrderResponse.StatusEnum.Draft;
  }

  canShowSubmit(order: PurchaseOrderResponse): boolean {
    return this.canEdit && order.status === PurchaseOrderResponse.StatusEnum.Draft;
  }

  canShowClose(order: PurchaseOrderResponse): boolean {
    return (
      this.canClose &&
      order.status !== PurchaseOrderResponse.StatusEnum.Received &&
      order.status !== PurchaseOrderResponse.StatusEnum.Closed
    );
  }

  canShowReceive(order: PurchaseOrderResponse): boolean {
    return (
      order.status !== PurchaseOrderResponse.StatusEnum.Received &&
      order.status !== PurchaseOrderResponse.StatusEnum.Closed
    );
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

  // ---- Submit ----
  openSubmitDialog(): void {
    this.submitDialogOpen.set(true);
  }

  closeSubmitDialog(): void {
    this.submitDialogOpen.set(false);
  }

  submitOrder(): void {
    const current = this.order();
    if (!current || current.id === undefined) return;
    const orderId = current.id;

    this.submitting.set(true);
    this.ordersService.submit(orderId).subscribe({
      next: (updated) => {
        this.order.set(updated);
        this.submitting.set(false);
        this.submitDialogOpen.set(false);
      },
      error: (err) => {
        this.submitting.set(false);
        this.submitDialogOpen.set(false);
        this.errorMessage.set(err?.error?.message || 'Could not submit this purchase order. Please try again.');
        this.loadOrder(orderId);
      },
    });
  }

  // ---- Close ----
  openCloseDialog(): void {
    this.closeDialogOpen.set(true);
  }

  closeCloseDialog(): void {
    this.closeDialogOpen.set(false);
  }

  closeOrder(): void {
    const current = this.order();
    if (!current || current.id === undefined) return;
    const orderId = current.id;

    this.closing.set(true);
    this.ordersService.close(orderId).subscribe({
      next: (updated) => {
        this.order.set(updated);
        this.closing.set(false);
        this.closeDialogOpen.set(false);
      },
      error: (err) => {
        this.closing.set(false);
        this.closeDialogOpen.set(false);
        this.errorMessage.set(err?.error?.message || 'Could not close this purchase order. Please try again.');
        this.loadOrder(orderId);
      },
    });
  }

  // ---- Enter/cancel edit ----
  enterEdit(): void {
    const current = this.order();
    if (!current) return;

    this.errorMessage.set(null);
    this.mode.set('edit');

    if (this.itemsLoaded()) {
      this.applyEditForm(current);
    } else {
      this.loadItems(() => this.applyEditForm(current));
    }
  }

  private applyEditForm(order: PurchaseOrderResponse): void {
    this.syncFormFromOrder(order);
  }

  cancelEdit(): void {
    const current = this.order();
    if (current) this.syncFormFromOrder(current);
    this.errorMessage.set(null);
    this.mode.set('view');
  }

  private syncFormFromOrder(order: PurchaseOrderResponse): void {
    this.editNotes.set(order.notes ?? '');
    const lines = order.lines ?? [];
    this.editLines.set(
      lines.length > 0
        ? lines.map(
            (l): DraftLine => ({
              itemId: l.itemId ?? null,
              quantity: l.quantity ?? null,
              notes: l.notes ?? '',
            }),
          )
        : [emptyLine()],
    );
  }

  onEditNotesChange(value: string): void {
    this.editNotes.set(value);
  }

  onEditLineItemChange(index: number, value: string): void {
    this.editLines.update((rows) =>
      rows.map((r, i) => (i === index ? { ...r, itemId: value ? Number(value) : null } : r)),
    );
  }

  onEditLineQuantityChange(index: number, value: string): void {
    this.editLines.update((rows) =>
      rows.map((r, i) => (i === index ? { ...r, quantity: value === '' ? null : Number(value) } : r)),
    );
  }

  onEditLineNotesChange(index: number, value: string): void {
    this.editLines.update((rows) => rows.map((r, i) => (i === index ? { ...r, notes: value } : r)));
  }

  addEditLine(): void {
    this.editLines.update((rows) => [...rows, emptyLine()]);
  }

  removeEditLine(index: number): void {
    this.editLines.update((rows) => (rows.length > 1 ? rows.filter((_, i) => i !== index) : rows));
  }

  saveEdit(): void {
    const current = this.order();
    if (!current || current.id === undefined) return;

    const validLines = this.editLines().filter((l) => l.itemId !== null && l.quantity && l.quantity > 0);
    if (validLines.length === 0) {
      this.errorMessage.set('At least one complete line item (item, quantity) is required.');
      return;
    }

    this.saving.set(true);
    this.errorMessage.set(null);

    const body: PurchaseOrderUpdateRequest = {
      notes: this.editNotes().trim() || undefined,
      lines: validLines.map(
        (l): PurchaseOrderLineRequest => ({
          itemId: l.itemId!,
          quantity: l.quantity!,
          notes: l.notes.trim() || undefined,
        }),
      ),
    };

    this.ordersService.update(current.id, body).subscribe({
      next: (updated) => {
        this.order.set(updated);
        this.saving.set(false);
        this.mode.set('view');
      },
      error: (err) => {
        this.saving.set(false);
        if (err?.status === 422) {
          this.errorMessage.set('This order can no longer be edited — it has already been submitted.');
          this.mode.set('view');
          this.loadOrder(current.id!);
        } else if (err?.status === 404) {
          this.errorMessage.set('One of the items in this order could not be found.');
        } else {
          this.errorMessage.set('Could not save changes. Please check the line items and try again.');
        }
      },
    });
  }

  private loadItems(onLoaded?: () => void): void {
    this.itemsService.listItems(undefined, true, undefined, 0, 300, undefined).subscribe({
      next: (result) => {
        this.items.set(result.content ?? []);
        this.itemsLoaded.set(true);
        onLoaded?.();
      },
    });
  }

  private loadOrder(id: number): void {
    this.loading.set(true);
    this.ordersService.getById(id).subscribe({
      next: (order) => {
        this.order.set(order);
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set('Purchase order not found.');
        this.loading.set(false);
      },
    });
  }
}
