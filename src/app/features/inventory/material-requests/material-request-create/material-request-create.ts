import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  ItemResponse,
  ItemsService,
  MaterialRequestCreateRequest,
  MaterialRequestLineItemRequest,
  MaterialRequestsService,
  WarehouseResponse,
  WarehousesService,
} from '../../../../generated';

interface DraftLine {
  itemId: number | null;
  quantityRequested: number | null;
  notes: string;
}

function emptyLine(): DraftLine {
  return { itemId: null, quantityRequested: null, notes: '' };
}

@Component({
  selector: 'app-material-request-create',
  imports: [],
  templateUrl: './material-request-create.html',
  styleUrl: './material-request-create.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MaterialRequestCreateComponent implements OnInit {
  private readonly materialRequestsService = inject(MaterialRequestsService);
  private readonly warehousesService = inject(WarehousesService);
  private readonly itemsService = inject(ItemsService);
  private readonly router = inject(Router);

  private readonly warehouses = signal<WarehouseResponse[]>([]);
  readonly items = signal<ItemResponse[]>([]);
  readonly loadingOptions = signal(true);

  // A site is just a Warehouse with type SITE — a request only makes sense
  // against one (a MAIN warehouse fulfills requests, it doesn't make them).
  readonly sites = computed(() => this.warehouses().filter((w) => w.type === WarehouseResponse.TypeEnum.Site));

  readonly siteWarehouseId = signal<number | null>(null);
  readonly dateNeeded = signal('');
  readonly notes = signal('');
  readonly lines = signal<DraftLine[]>([emptyLine()]);

  readonly saving = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly totalItemCount = computed(() =>
    this.lines().reduce((sum, l) => sum + (l.quantityRequested ?? 0), 0),
  );

  ngOnInit(): void {
    this.loadOptions();
  }

  backToList(): void {
    this.router.navigate(['/inventory/material-requests']);
  }

  onSiteChange(value: string): void {
    this.siteWarehouseId.set(value ? Number(value) : null);
  }

  onDateNeededChange(value: string): void {
    this.dateNeeded.set(value);
  }

  onNotesChange(value: string): void {
    this.notes.set(value);
  }

  onLineItemChange(index: number, value: string): void {
    this.lines.update((rows) =>
      rows.map((r, i) => (i === index ? { ...r, itemId: value ? Number(value) : null } : r)),
    );
  }

  onLineQtyChange(index: number, value: string): void {
    this.lines.update((rows) =>
      rows.map((r, i) => (i === index ? { ...r, quantityRequested: value === '' ? null : Number(value) } : r)),
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

  createRequest(): void {
    const siteWarehouseId = this.siteWarehouseId();
    const validLines = this.lines().filter((l) => l.itemId !== null && l.quantityRequested && l.quantityRequested > 0);

    if (!siteWarehouseId) {
      this.errorMessage.set('Site is required.');
      return;
    }
    if (validLines.length === 0) {
      this.errorMessage.set('At least one complete line item (item, quantity) is required.');
      return;
    }

    this.saving.set(true);
    this.errorMessage.set(null);

    const body: MaterialRequestCreateRequest = {
      siteWarehouseId,
      dateNeeded: this.dateNeeded() || undefined,
      notes: this.notes().trim() || undefined,
      lines: validLines.map(
        (l): MaterialRequestLineItemRequest => ({
          itemId: l.itemId!,
          quantityRequested: l.quantityRequested!,
          notes: l.notes.trim() || undefined,
        }),
      ),
    };

    this.materialRequestsService.create(body).subscribe({
      next: (created) => {
        this.saving.set(false);
        this.router.navigate(['/inventory/material-requests', created.id]);
      },
      error: (err) => {
        this.saving.set(false);
        this.errorMessage.set(
          err?.status === 400
            ? 'The selected site must be a SITE-type warehouse, and every line must reference a valid item.'
            : err?.status === 404
              ? 'The site, or one of the items, could not be found.'
              : 'Could not create material request. Please check the form and try again.',
        );
      },
    });
  }

  private loadOptions(): void {
    this.loadingOptions.set(true);

    this.warehousesService.listWarehouses(true, 0, 200, undefined).subscribe({
      next: (result) => this.warehouses.set(result.content ?? []),
      error: () => this.errorMessage.set('Could not load sites.'),
    });

    this.itemsService.listItems(undefined, true, undefined, 0, 300, undefined).subscribe({
      next: (result) => {
        this.items.set(result.content ?? []);
        this.loadingOptions.set(false);
      },
      error: () => {
        this.errorMessage.set('Could not load items.');
        this.loadingOptions.set(false);
      },
    });
  }
}
