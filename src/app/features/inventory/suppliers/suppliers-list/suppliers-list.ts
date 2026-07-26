import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import {
  SupplierCreateRequest,
  SupplierResponse,
  SuppliersService,
  SupplierUpdateRequest,
} from '../../../../generated';
 
const PAGE_SIZE = 6;
// Large enough to cover the realistic supplier count in one request.
// GET /api/suppliers has no `search` param (unlike /api/items), so search
// and pagination both happen client-side here against this full list —
// see note below saveForm(). Worth adding server-side search if the
// supplier count ever outgrows a single page fetch.
const FETCH_SIZE = 500;
 
interface SupplierForm {
  name: string;
  contactInfo: string;
}
 
const EMPTY_FORM: SupplierForm = { name: '', contactInfo: '' };
 
@Component({
  selector: 'app-suppliers-list',
  imports: [DatePipe],
  templateUrl: './suppliers-list.html',
  styleUrl: './suppliers-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SuppliersListComponent implements OnInit {
  private readonly suppliersService = inject(SuppliersService);
 
  // ---- Full dataset + client-side filter/paginate state ----
  private readonly allSuppliers = signal<SupplierResponse[]>([]);
  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);
 
  readonly search = signal('');
  readonly showInactive = signal(false);
  readonly page = signal(1); // 1-based, matches the original design
 
  readonly filtered = computed(() => {
    const term = this.search().trim().toLowerCase();
    return this.allSuppliers().filter((s) => {
      if (!this.showInactive() && !s.active) return false;
      if (term && !(s.name ?? '').toLowerCase().includes(term)) return false;
      return true;
    });
  });
 
  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.filtered().length / PAGE_SIZE)));
  readonly currentPage = computed(() => Math.min(this.page(), this.totalPages()));
 
  readonly pageItems = computed(() => {
    const start = (this.currentPage() - 1) * PAGE_SIZE;
    return this.filtered().slice(start, start + PAGE_SIZE);
  });
 
  readonly hasResults = computed(() => this.filtered().length > 0);
  readonly isFilteredEmpty = computed(() => this.filtered().length === 0 && this.allSuppliers().length > 0);
  readonly isTrulyEmpty = computed(() => this.allSuppliers().length === 0);
 
  readonly pageSummary = computed(() => {
    const total = this.filtered().length;
    if (total === 0) return '';
    const start = (this.currentPage() - 1) * PAGE_SIZE + 1;
    const end = Math.min(this.currentPage() * PAGE_SIZE, total);
    return `Showing ${start}–${end} of ${total}`;
  });
 
  // ---- Drawer state ----
  readonly drawerOpen = signal(false);
  readonly selectedId = signal<number | null>(null);
  readonly selected = computed(() =>
    this.selectedId() ? (this.allSuppliers().find((s) => s.id === this.selectedId()) ?? null) : null,
  );
  readonly isEditingExisting = computed(() => this.selectedId() !== null);
 
  readonly form = signal<SupplierForm>({ ...EMPTY_FORM });
  readonly saving = signal(false);
  readonly toggling = signal(false);
  readonly drawerError = signal<string | null>(null);
 
  ngOnInit(): void {
    this.fetchSuppliers();
  }
 
  onSearchChange(value: string): void {
    this.search.set(value);
    this.page.set(1);
  }
 
  onShowInactiveChange(checked: boolean): void {
    this.showInactive.set(checked);
    this.page.set(1);
  }
 
  prevPage(): void {
    this.page.update((p) => Math.max(1, p - 1));
  }
 
  nextPage(): void {
    this.page.update((p) => Math.min(this.totalPages(), p + 1));
  }
 
  openNew(): void {
    this.selectedId.set(null);
    this.form.set({ ...EMPTY_FORM });
    this.drawerError.set(null);
    this.drawerOpen.set(true);
  }
 
  openExisting(supplier: SupplierResponse): void {
  if (supplier.id === undefined) return;
  this.selectedId.set(supplier.id);
  this.form.set({ name: supplier.name ?? '', contactInfo: supplier.contactInfo ?? '' });
  this.drawerError.set(null);
  this.drawerOpen.set(true);
}
 
  closeDrawer(): void {
    this.drawerOpen.set(false);
  }
 
  onFormNameChange(value: string): void {
    this.form.update((f) => ({ ...f, name: value }));
  }
 
  onFormContactChange(value: string): void {
    this.form.update((f) => ({ ...f, contactInfo: value }));
  }
 
  saveForm(): void {
    const f = this.form();
    if (!f.name.trim()) {
      this.drawerError.set('Name is required.');
      return;
    }
 
    this.saving.set(true);
    this.drawerError.set(null);
    const id = this.selectedId();
 
    const request$ = id
      ? this.suppliersService.updateSupplier(id, {
          name: f.name.trim(),
          contactInfo: f.contactInfo.trim() || undefined,
        } satisfies SupplierUpdateRequest)
      : this.suppliersService.createSupplier({
          name: f.name.trim(),
          contactInfo: f.contactInfo.trim() || undefined,
        } satisfies SupplierCreateRequest);
 
    request$.subscribe({
      next: () => {
        this.saving.set(false);
        this.drawerOpen.set(false);
        this.fetchSuppliers();
      },
      error: () => {
        this.saving.set(false);
        this.drawerError.set('Could not save supplier. Please try again.');
      },
    });
  }
 
  // Deactivate uses the dedicated PATCH endpoint; reactivate goes through
  // the general update endpoint with active: true, since there's no
  // separate "reactivate" route — unlike Items, Suppliers actually
  // supports this because SupplierUpdateRequest has an `active` field.
  toggleActive(): void {
    const current = this.selected();
    if (!current || current.id === undefined) return;

    this.toggling.set(true);
    const request$ = current.active
      ? this.suppliersService.deactivateSupplier(current.id)
      : this.suppliersService.updateSupplier(current.id, { active: true } satisfies SupplierUpdateRequest);
    
    request$.subscribe({
      next: () => {
        this.toggling.set(false);
        this.fetchSuppliers();
      },
      error: () => {
        this.toggling.set(false);
        this.drawerError.set('Could not update status. Please try again.');
      },
    });
  }
 
  deactivateLabel(): string {
    return this.selected()?.active ? 'Deactivate' : 'Reactivate';
  }
 
  private fetchSuppliers(): void {
    this.loading.set(true);
    this.errorMessage.set(null);
 
    // active omitted (undefined) — fetch both active and inactive, then
    // filter client-side against showInactive, same as search.
    this.suppliersService.listSuppliers(undefined, 0, FETCH_SIZE, undefined).subscribe({
      next: (result) => {
        this.allSuppliers.set(result.content ?? []);
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set('Could not load suppliers. Please try again.');
        this.loading.set(false);
      },
    });
  }
}