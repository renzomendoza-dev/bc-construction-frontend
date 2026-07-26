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
      path: 'items/:id',
      loadComponent: () =>
        import('./features/inventory/items/item-detail/item-detail').then((m) => m.ItemDetailComponent),
    },
      // {
      //   path: 'suppliers',
      //   loadComponent: () =>
      //     import('./features/inventory/suppliers/suppliers.component').then(m => m.SuppliersComponent),
      // },
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