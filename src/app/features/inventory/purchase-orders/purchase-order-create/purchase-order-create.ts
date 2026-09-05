import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import {
  ItemResponse,
  ItemsService,
  PurchaseOrderCreateRequest,
  PurchaseOrderLineRequest,
  PurchaseOrderSuggestionItem,
  PurchaseOrdersService,
  SupplierResponse,
  SuppliersService,
} from '../../../../generated';

interface DraftLine {
  itemId: number | null;
  quantity: number | null;
  notes: string;
  // Label shown as locked text instead of a <select> while !editingItem.
  displayName: string;
  // Lines pre-filled from GET /suggestions are locked to plain text instead
  // of a <select> — setting several lines' itemId at once (one HTTP
  // response mapped straight into N rows) only ever reliably applies to the
  // first freshly-created <select>, the same native-select timing bug
  // fixed the same way on the Purchase Order detail page's edit form. To
  // change a suggested line's item, remove it and use "+ Add Line" instead,
  // which always starts as a single fresh <select> (the case that works).
  editingItem: boolean;
}

function emptyLine(): DraftLine {
  return { itemId: null, quantity: null, notes: '', displayName: '', editingItem: true };
}

@Component({
  selector: 'app-purchase-order-create',
  imports: [],
  templateUrl: './purchase-order-create.html',
  styleUrl: './purchase-order-create.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PurchaseOrderCreateComponent implements OnInit {
  private readonly ordersService = inject(PurchaseOrdersService);
  private readonly suppliersService = inject(SuppliersService);
  private readonly itemsService = inject(ItemsService);
  private readonly router = inject(Router);

  readonly suppliers = signal<SupplierResponse[]>([]);
  readonly items = signal<ItemResponse[]>([]);
  readonly loadingOptions = signal(true);

  readonly supplierId = signal<number | null>(null);
  readonly notes = signal('');
  readonly lines = signal<DraftLine[]>([emptyLine()]);

  // Kept around purely so the form can show a "Suggested" hint next to lines
  // that came from GET /suggestions — editing a line's quantity or removing
  // it entirely doesn't affect this list, it's just a display aid.
  readonly suggestions = signal<PurchaseOrderSuggestionItem[]>([]);
  readonly loadingSuggestions = signal(false);
  readonly suggestionByItemId = computed(() => new Map(this.suggestions().map((s) => [s.itemId, s])));

  readonly saving = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly totalLineCount = computed(() => this.lines().filter((l) => l.itemId !== null).length);

  ngOnInit(): void {
    this.loadOptions();
  }

  backToList(): void {
    this.router.navigate(['/inventory/purchase-orders']);
  }

  itemName(itemId: number | null): string {
    const item = this.items().find((i) => i.id === itemId);
    return item ? `${item.name} (${item.sku})` : '';
  }

  suggestionSourceLabel(source: string): string {
    switch (source) {
      case 'AWAITING_PURCHASE_TRANSFER':
        return 'blocked transfer';
      case 'LOW_STOCK':
        return 'low stock';
      case 'OPEN_MATERIAL_REQUEST':
        return 'open request';
      default:
        return source;
    }
  }

  onSupplierChange(value: string): void {
    const supplierId = value ? Number(value) : null;
    this.supplierId.set(supplierId);
    this.suggestions.set([]);
    this.lines.set([emptyLine()]);
    if (supplierId !== null) {
      this.loadSuggestions(supplierId);
    }
  }

  onNotesChange(value: string): void {
    this.notes.set(value);
  }

  // Excludes items already picked on other lines, so the same item can't be
  // added twice — the current line's own selection is excluded only from
  // every *other* line's options, so it still shows as selected there.
  itemOptionsFor(index: number): ItemResponse[] {
    const chosenElsewhere = new Set(
      this.lines()
        .filter((_, i) => i !== index)
        .map((l) => l.itemId)
        .filter((id): id is number => id !== null),
    );
    return this.items().filter((item) => item.id === undefined || !chosenElsewhere.has(item.id));
  }

  onLineItemChange(index: number, value: string): void {
    this.lines.update((rows) =>
      rows.map((r, i) => (i === index ? { ...r, itemId: value ? Number(value) : null } : r)),
    );
  }

  onLineQuantityChange(index: number, value: string): void {
    this.lines.update((rows) =>
      rows.map((r, i) => (i === index ? { ...r, quantity: value === '' ? null : Number(value) } : r)),
    );
  }

  onLineNotesChange(index: number, value: string): void {
    this.lines.update((rows) => rows.map((r, i) => (i === index ? { ...r, notes: value } : r)));
  }

  addLine(): void {
    this.lines.update((rows) => [...rows, emptyLine()]);
  }

  removeLine(index: number): void {
    this.lines.update((rows) => (rows.length > 1 ? rows.filter((_, i) => i !== index) : rows));
  }

  saveDraft(): void {
    const supplierId = this.supplierId();
    const validLines = this.lines().filter((l) => l.itemId !== null && l.quantity && l.quantity > 0);

    if (!supplierId) {
      this.errorMessage.set('Select a supplier.');
      return;
    }
    if (validLines.length === 0) {
      this.errorMessage.set('At least one complete line item (item, quantity) is required.');
      return;
    }

    this.saving.set(true);
    this.errorMessage.set(null);

    const body: PurchaseOrderCreateRequest = {
      supplierId,
      notes: this.notes().trim() || undefined,
      lines: validLines.map(
        (l): PurchaseOrderLineRequest => ({
          itemId: l.itemId!,
          quantity: l.quantity!,
          notes: l.notes.trim() || undefined,
        }),
      ),
    };

    this.ordersService.createDraft(body).subscribe({
      next: (created) => {
        this.saving.set(false);
        this.router.navigate(['/inventory/purchase-orders', created.id]);
      },
      error: (err) => {
        this.saving.set(false);
        this.errorMessage.set(
          err?.error?.message ||
            (err?.status === 404
              ? 'The selected supplier, or one of the selected items, could not be found.'
              : 'Could not create this purchase order. Please check the form and try again.'),
        );
      },
    });
  }

  private loadSuggestions(supplierId: number): void {
    this.loadingSuggestions.set(true);
    this.ordersService.getSuggestions(supplierId).subscribe({
      next: (result) => {
        const suggestions = result.suggestions ?? [];
        this.suggestions.set(suggestions);
        if (suggestions.length > 0) {
          this.lines.set(
            suggestions.map(
              (s): DraftLine => ({
                itemId: s.itemId ?? null,
                quantity: s.suggestedQuantity ?? null,
                notes: '',
                displayName: s.itemSku ? `${s.itemName} (${s.itemSku})` : (s.itemName ?? ''),
                editingItem: false,
              }),
            ),
          );
        }
        this.loadingSuggestions.set(false);
      },
      error: () => {
        // Suggestions are a convenience, not a requirement — a failed fetch
        // just leaves the form with one empty line to fill in manually.
        this.loadingSuggestions.set(false);
      },
    });
  }

  private loadOptions(): void {
    this.loadingOptions.set(true);

    forkJoin({
      suppliers: this.suppliersService.listSuppliers(true, 0, 200, undefined),
      items: this.itemsService.listItems(undefined, true, undefined, 0, 300, undefined),
    }).subscribe({
      next: ({ suppliers, items }) => {
        this.suppliers.set(suppliers.content ?? []);
        this.items.set(items.content ?? []);
        this.loadingOptions.set(false);
      },
      error: () => {
        this.errorMessage.set('Could not load suppliers or items.');
        this.loadingOptions.set(false);
      },
    });
  }
}
