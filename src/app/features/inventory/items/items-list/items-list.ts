import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ItemResponse, ItemsService } from '../../../../generated';
 
const CATEGORIES = ['Framing', 'Concrete', 'Reinforcement', 'Insulation', 'Sheathing', 'Fasteners'];
const PAGE_SIZE = 20;

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
 
  readonly categories = CATEGORIES;
 
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
    // No create-item modal existed in the original mockup — this route
    // doesn't exist yet. Wire this to a real create flow when you design
    // one; for now it's a placeholder so the button isn't dead-clickable
    // without at least navigating somewhere sensible.
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

}
 