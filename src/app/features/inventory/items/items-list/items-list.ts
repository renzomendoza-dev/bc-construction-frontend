import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ItemResponse, ItemsService } from '../../../../generated';
import { CurrentUserService } from '../../../../core/services/current-user';
import { Permission } from '../../../../core/constants/permissions';

const PAGE_SIZE = 20;
// Category is free text on Item (no backend enum/endpoint for it), so the
// filter's option list is derived from whatever categories actually exist
// today rather than a hand-maintained list that inevitably drifts from real
// data — same "fetch a large batch, derive distinct values" tradeoff used
// elsewhere in this app.
const CATEGORY_SCAN_SIZE = 500;

@Component({
  selector: 'app-items-list',
  imports: [],
  templateUrl: './items-list.html',
  styleUrl: './items-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ItemsListComponent implements OnInit {
  private readonly itemsService = inject(ItemsService);
  private readonly router = inject(Router);
  private readonly currentUser = inject(CurrentUserService);

  readonly categories = signal<string[]>([]);
  readonly canCreate = this.currentUser.hasPermission(Permission.ItemCreate);
 
  readonly search = signal('');
  readonly category = signal('all');
  readonly showInactive = signal(false);
  readonly page = signal(0); // API is zero-based
 
  readonly items = signal<ItemResponse[]>([]);
  readonly totalElements = signal(0);
  readonly totalPages = signal(1);
  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);
 
  ngOnInit(): void {
    this.fetchItems();
    this.loadCategoryOptions();
  }
  onSearchChange(value: string): void {
    this.search.set(value);
    this.page.set(0);
    this.fetchItems();
  }
 
  onCategoryChange(value: string): void {
    this.category.set(value);
    this.page.set(0);
    this.fetchItems();
  }
 
  onShowInactiveChange(checked: boolean): void {
    this.showInactive.set(checked);
    this.page.set(0);
    this.fetchItems();
  }
 
  prevPage(): void {
    if (this.page() === 0) return;
    this.page.update((p) => p - 1);
    this.fetchItems();
  }
 
  nextPage(): void {
    if (this.page() >= this.totalPages() - 1) return;
    this.page.update((p) => p + 1);
    this.fetchItems();
  }
 
  openItem(id: number | undefined): void {
  if (id === undefined) return;
  this.router.navigate(['/inventory/items', id]);
}
 
  createItem(): void {
    this.router.navigate(['/inventory/items/new']);
  }
 
  statusLabel(item: ItemResponse): string {
    return item.active ? 'Active' : 'Inactive';
  }
 
  private fetchItems(): void {
  this.loading.set(true);
  this.errorMessage.set(null);

  this.itemsService
    .listItems(
      this.category() === 'all' ? undefined : this.category(),
      this.showInactive() ? undefined : true,
      this.search().trim() || undefined,
      this.page(),
      PAGE_SIZE,
    )
    .subscribe({
      next: (result) => {
        this.items.set(result.content ?? []);
        this.totalElements.set(result.totalElements ?? 0);
        this.totalPages.set(Math.max(1, result.totalPages ?? 1));
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set('Could not load items. Please try again.');
        this.loading.set(false);
      },
    });
}

  // Scans active + inactive items (undefined active filter) so a category
  // used only by a deactivated item still shows up as a filter option.
  private loadCategoryOptions(): void {
    this.itemsService.listItems(undefined, undefined, undefined, 0, CATEGORY_SCAN_SIZE).subscribe({
      next: (result) => {
        const distinct = new Set(
          (result.content ?? [])
            .map((i) => i.category)
            .filter((c): c is string => !!c),
        );
        this.categories.set(Array.from(distinct).sort());
      },
      error: () => {
        this.categories.set([]);
      },
    });
  }
}
 