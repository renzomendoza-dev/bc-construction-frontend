import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

interface InventorySubRoute {
  path: string;
  label: string;
}

@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.data-theme]': 'theme()',
    '[class.is-expanded]': 'expanded()',
    '[class.is-collapsed]': '!expanded()',
  },
})
export class Sidebar {
  // ---- State ----------------------------------------------------------
  readonly theme = signal<'light' | 'dark'>('light');
  readonly expanded = signal(true);
  readonly inventoryOpen = signal(true);
 
  // ---- Static nav config ------------------------------------------------
  readonly inventoryRoutes: InventorySubRoute[] = [
    { path: '/inventory/items', label: 'Items' },
    { path: '/inventory/suppliers', label: 'Suppliers' },
    { path: '/inventory/warehouses', label: 'Warehouses' },
    { path: '/inventory/receipts', label: 'Purchase Receipts' },
  ];
 
  // ---- Derived display state --------------------------------------------
  readonly showInventorySub = computed(() => this.expanded() && this.inventoryOpen());
  readonly isDark = computed(() => this.theme() === 'dark');
 
  // ---- Actions ------------------------------------------------------------
  toggleTheme(): void {
    this.theme.update((t) => (t === 'dark' ? 'light' : 'dark'));
  }
 
  toggleCollapse(): void {
    const willExpand = !this.expanded();
    this.expanded.set(willExpand);
    // Mirrors the original behavior: collapsing the rail also closes the
    // Inventory submenu so it doesn't silently reopen full-width later.
    if (!willExpand) {
      this.inventoryOpen.set(false);
    }
  }
 
  toggleInventory(): void {
    if (!this.expanded()) {
      // Clicking the (icon-only) Inventory row while collapsed re-expands
      // the rail and opens the submenu in one action, same as the mockup.
      this.expanded.set(true);
      this.inventoryOpen.set(true);
      return;
    }
    this.inventoryOpen.update((open) => !open);
  }
}
