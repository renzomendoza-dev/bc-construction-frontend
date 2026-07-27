import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { LayoutService } from '../../services/layout';

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
    '[class.is-expanded]': 'expanded()',
    '[class.is-collapsed]': '!expanded()',
  },
})
export class Sidebar {
  private readonly layout = inject(LayoutService);

  // ---- State ----------------------------------------------------------
  // expanded now comes from the shared service, so the top bar's hamburger
  // button and this component stay in sync.
  readonly expanded = this.layout.sidebarExpanded;
  readonly inventoryOpen = signal(true);

  // ---- Static nav config ------------------------------------------------
  readonly inventoryRoutes: InventorySubRoute[] = [
    { path: '/inventory/items', label: 'Items' },
    { path: '/inventory/suppliers', label: 'Suppliers' },
    { path: '/inventory/warehouses', label: 'Warehouses' },
    { path: '/inventory/purchase-receipts', label: 'Purchase Receipts' },
  ];

  // ---- Derived display state --------------------------------------------
  readonly showInventorySub = computed(() => this.expanded() && this.inventoryOpen());

  // ---- Actions ------------------------------------------------------------
  toggleCollapse(): void {
    const willExpand = !this.expanded();
    this.layout.sidebarExpanded.set(willExpand);
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
      this.layout.sidebarExpanded.set(true);
      this.inventoryOpen.set(true);
      return;
    }
    this.inventoryOpen.update((open) => !open);
  }
}
