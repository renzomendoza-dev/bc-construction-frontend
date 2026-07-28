import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/dashboard/dashboard').then((m) => m.Dashboard),
  },

  {
    path: 'inventory',
    children: [
      { path: '', redirectTo: 'items', pathMatch: 'full' },
      {
        path: 'items',
        loadComponent: () =>
          import('./features/inventory/items/items-list/items-list').then((m) => m.ItemsListComponent),
      },
      {
        path: 'items/new',
        loadComponent: () =>
          import('./features/inventory/items/item-create/item-create').then((m) => m.ItemCreateComponent),
      },
      {
        path: 'items/:id',
        loadComponent: () =>
          import('./features/inventory/items/item-detail/item-detail').then((m) => m.ItemDetailComponent),
      },
      {
        path: 'suppliers',
        loadComponent: () =>
          import('./features/inventory/suppliers/suppliers-list/suppliers-list').then((m) => m.SuppliersListComponent),
      },
      {
        path: 'warehouses',
        loadComponent: () =>
          import('./features/inventory/warehouses/warehouses-list/warehouses-list').then((m) => m.WarehousesListComponent),
      },
      {
        path: 'purchase-receipts',
        loadComponent: () =>
          import('./features/inventory/purchase-receipts/purchase-receipts-list/purchase-receipts-list').then(
            (m) => m.PurchaseReceiptsListComponent,
          ),
      },
      {
        path: 'purchase-receipts/new',
        loadComponent: () =>
          import('./features/inventory/purchase-receipts/purchase-receipt-create/purchase-receipt-create').then(
            (m) => m.PurchaseReceiptCreateComponent,
          ),
      },
      {
        path: 'purchase-receipts/:id',
        loadComponent: () =>
          import('./features/inventory/purchase-receipts/purchase-receipt-detail/purchase-receipt-detail').then(
            (m) => m.PurchaseReceiptDetailComponent,
          ),
      },
      {
        path: 'stock',
        loadComponent: () =>
          import('./features/inventory/stocks/stock-levels/stock-levels').then(
            (m) => m.StockLevelsComponent,
          ),
      },
      // {
      //   path: 'warehouses',
      //   loadComponent: () =>
      //     import('./features/inventory/warehouses/warehouses.component').then(m => m.WarehousesComponent),
      // },
      // {
      //   path: 'receipts',
      //   loadComponent: () =>
      //     import('./features/inventory/receipts/receipts.component').then(m => m.ReceiptsComponent),
      // },
    ],
  },

  {
    path: '**',
    redirectTo: '',
  },
];