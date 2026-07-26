import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ItemCreateRequest, ItemsService } from '../../../../generated';
 
const CATEGORIES = ['Framing', 'Concrete', 'Reinforcement', 'Insulation', 'Sheathing', 'Fasteners'];
 
interface CreateForm {
  sku: string;
  name: string;
  category: string;
  unitOfMeasure: string;
  sellingPrice: number | null;
  defaultCostPrice: number | null;
}
 
const EMPTY_FORM: CreateForm = {
  sku: '',
  name: '',
  category: CATEGORIES[0],
  unitOfMeasure: '',
  sellingPrice: null,
  defaultCostPrice: null,
};

@Component({
  selector: 'app-item-create',
  imports: [],
  templateUrl: './item-create.html',
  styleUrl: './item-create.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ItemCreateComponent {
  private readonly itemsService = inject(ItemsService);
  private readonly router = inject(Router);
 
  readonly categories = CATEGORIES;
  readonly form = signal<CreateForm>({ ...EMPTY_FORM });
 
  readonly saving = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly fieldErrors = signal<Record<string, string>>({});
 
  backToList(): void {
    this.router.navigate(['/inventory/items']);
  }
 
  onSkuChange(value: string): void {
    this.form.update((f) => ({ ...f, sku: value }));
  }
 
  onNameChange(value: string): void {
    this.form.update((f) => ({ ...f, name: value }));
  }
 
  onCategoryChange(value: string): void {
    this.form.update((f) => ({ ...f, category: value }));
  }
 
  onUnitChange(value: string): void {
    this.form.update((f) => ({ ...f, unitOfMeasure: value }));
  }
 
  onPriceChange(value: string): void {
    this.form.update((f) => ({ ...f, sellingPrice: value === '' ? null : Number(value) }));
  }
 
  onCostChange(value: string): void {
    this.form.update((f) => ({ ...f, defaultCostPrice: value === '' ? null : Number(value) }));
  }
 
  createItem(): void {
    const f = this.form();
 
    // Mirrors the backend's own required fields (ItemCreateRequest: name,
    // sku) — catches the obvious case client-side before round-tripping
    // to the server's 400 response.
    if (!f.sku.trim() || !f.name.trim()) {
      this.errorMessage.set('SKU and Name are required.');
      return;
    }
 
    this.saving.set(true);
    this.errorMessage.set(null);
    this.fieldErrors.set({});
 
    const body: ItemCreateRequest = {
      sku: f.sku.trim(),
      name: f.name.trim(),
      category: f.category || undefined,
      unitOfMeasure: f.unitOfMeasure || undefined,
      sellingPrice: f.sellingPrice ?? undefined,
      defaultCostPrice: f.defaultCostPrice ?? undefined,
    };
 
    this.itemsService.createItem(body).subscribe({
      next: (created) => {
        this.saving.set(false);
        // Images and supplier links can only be added once the item
        // exists — land on its detail page to continue from there.
        this.router.navigate(['/inventory/items', created.id]);
      },
      error: (err) => {
        this.saving.set(false);
        if (err?.status === 409) {
          this.errorMessage.set('An item with this SKU already exists.');
        } else if (err?.status === 400 && err?.error?.fieldErrors) {
          this.fieldErrors.set(err.error.fieldErrors);
          this.errorMessage.set('Please fix the highlighted fields.');
        } else {
          this.errorMessage.set('Could not create item. Please try again.');
        }
      },
    });
  }
}
 
