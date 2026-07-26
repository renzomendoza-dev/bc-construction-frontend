import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { ItemResponse, ItemsService, ItemSupplierResponse, SuppliersService } from '../../../../generated';

 
const CATEGORIES = ['Framing', 'Concrete', 'Reinforcement', 'Insulation', 'Sheathing', 'Fasteners'];
 
interface EditForm {
  category: string;
  unitOfMeasure: string;
  sellingPrice: number | null;
  defaultCostPrice: number | null;
}
 
@Component({
  selector: 'app-item-detail',
  imports: [DatePipe],
  templateUrl: './item-detail.html',
  styleUrl: './item-detail.scss',
})
export class ItemDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly itemsService = inject(ItemsService);
  private readonly suppliersService = inject(SuppliersService);
 
  readonly categories = CATEGORIES;
 
  readonly item = signal<ItemResponse | null>(null);
  readonly suppliers = signal<ItemSupplierResponse[]>([]);
  readonly loading = signal(true);
  readonly errorMessage = signal<string | null>(null);
 
  readonly form = signal<EditForm>({ category: '', unitOfMeasure: '', sellingPrice: null, defaultCostPrice: null });
  readonly saving = signal(false);
  readonly savedMessage = signal('');
 
  readonly uploadingImage = signal(false);
  readonly deactivating = signal(false);
 
  ngOnInit(): void {
    const itemId = Number(this.route.snapshot.paramMap.get('id'));
    if (!itemId) {
      this.errorMessage.set('Invalid item id.');
      this.loading.set(false);
      return;
    }
    this.loadItem(itemId);
  }
 
  backToList(): void {
    this.router.navigate(['/inventory/items']);
  }
 
  onFormCategoryChange(value: string): void {
    this.form.update((f) => ({ ...f, category: value }));
  }
 
  onFormUnitChange(value: string): void {
    this.form.update((f) => ({ ...f, unitOfMeasure: value }));
  }
 
  onFormPriceChange(value: string): void {
    this.form.update((f) => ({ ...f, sellingPrice: value === '' ? null : Number(value) }));
  }
 
  onFormCostChange(value: string): void {
    this.form.update((f) => ({ ...f, defaultCostPrice: value === '' ? null : Number(value) }));
  }
 
  saveForm(): void {
    const current = this.item();
    if (!current) return;

    if (!current?.id) return;
 
    this.saving.set(true);
    this.savedMessage.set('');
    const f = this.form();
 
    this.itemsService
      .updateItem(current.id, {
        category: f.category,
        unitOfMeasure: f.unitOfMeasure,
        sellingPrice: f.sellingPrice ?? undefined,
        defaultCostPrice: f.defaultCostPrice ?? undefined,
      })
      .subscribe({
        next: (updated) => {
          this.item.set(updated);
          this.saving.set(false);
          this.savedMessage.set('Saved.');
        },
        error: () => {
          this.saving.set(false);
          this.savedMessage.set('Save failed — please try again.');
        },
      });
  }
 
  // Deactivate only — there is currently no API endpoint to reactivate an
  // item once deactivated (no `active` field on ItemUpdateRequest, no
  // reverse endpoint). This is a backend gap, not a frontend limitation;
  // the button is disabled for already-inactive items rather than
  // pretending reactivation works.
  deactivateItem(): void {
    const current = this.item();
    if (!current || !current.active) return;

    if (!current?.id) return;
 
    this.deactivating.set(true);
    this.itemsService.deactivateItem(current.id).subscribe({
      next: () => {
        this.item.update((i) => (i ? { ...i, active: false } : i));
        this.deactivating.set(false);
      },
      error: () => {
        this.deactivating.set(false);
        this.errorMessage.set('Could not deactivate item. Please try again.');
      },
    });
  }
 
  onImageFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    const current = this.item();
    if (!file || !current) return;

    if (!current?.id) return;
 
    this.uploadingImage.set(true);
    this.itemsService.uploadItemImage(current.id, file).subscribe({
      next: (image) => {
        this.item.update((i) => (i ? { ...i, images: [...(i.images ?? []), image] } : i));
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
 
  deleteImage(imageId: number): void {
    this.itemsService.removeItemImage(imageId).subscribe({
      next: () => {
        this.item.update((i) => (i ? { ...i, images: (i.images ?? []).filter((img) => img.id !== imageId) } : i));
      },
      error: () => {
        this.errorMessage.set('Could not remove image. Please try again.');
      },
    });
  }
 
  private loadItem(itemId: number): void {
    this.loading.set(true);
    this.itemsService.getItemById(itemId).subscribe({
      next: (item) => {
        this.item.set(item);
        this.form.set({
          category: item.category ?? '',
          unitOfMeasure: item.unitOfMeasure ?? '',
          sellingPrice: item.sellingPrice ?? null,
          defaultCostPrice: item.defaultCostPrice ?? null,
        });
        this.loading.set(false);
        this.loadSuppliers(itemId);
      },
      error: () => {
        this.errorMessage.set('Item not found.');
        this.loading.set(false);
      },
    });
  }
 
  private loadSuppliers(itemId: number): void {
    this.suppliersService.getSuppliersForItem(itemId).subscribe({
      next: (suppliers) => this.suppliers.set(suppliers),
      error: () => {
        // Non-fatal — the rest of the page is still useful without this.
        this.suppliers.set([]);
      },
    });
  }
}
 