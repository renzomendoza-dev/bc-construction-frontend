import { Routes } from '@angular/router';
import { adminGuard } from './core/guards/admin.guard';
import { permissionGuard } from './core/guards/permission.guard';
import { Permission } from './core/constants/permissions';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/dashboard/dashboard').then((m) => m.Dashboard),
  },

  {
    path: 'equipment',
    children: [
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () =>
          import('./features/equipment/equipment-list/equipment-list').then((m) => m.EquipmentListComponent),
      },
      {
        path: 'assignment-batches',
        loadComponent: () =>
          import('./features/equipment/equipment-assignment-batches-list/equipment-assignment-batches-list').then(
            (m) => m.EquipmentAssignmentBatchesListComponent,
          ),
      },
      {
        path: 'assignment-batches/new',
        loadComponent: () =>
          import('./features/equipment/equipment-assignment-batch-create/equipment-assignment-batch-create').then(
            (m) => m.EquipmentAssignmentBatchCreateComponent,
          ),
      },
      {
        path: 'assignment-batches/:id',
        loadComponent: () =>
          import('./features/equipment/equipment-assignment-batch-detail/equipment-assignment-batch-detail').then(
            (m) => m.EquipmentAssignmentBatchDetailComponent,
          ),
      },
    ],
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
        canActivate: [permissionGuard(Permission.ItemCreate, '/inventory/items')],
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
        canActivate: [permissionGuard(Permission.PurchaseReceiptCreate, '/inventory/purchase-receipts')],
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
      {
        path: 'transfers',
        loadComponent: () =>
          import('./features/inventory/transfers/transfer-batches-list/transfer-batches-list').then(
            (m) => m.TransferBatchesListComponent,
          ),
      },
      {
        path: 'transfers/new',
        canActivate: [permissionGuard(Permission.TransferBatchCreate, '/inventory/transfers')],
        loadComponent: () =>
          import('./features/inventory/transfers/transfer-batch-create/transfer-batch-create').then(
            (m) => m.TransferBatchCreateComponent,
          ),
      },
      {
        path: 'transfers/:id',
        loadComponent: () =>
          import('./features/inventory/transfers/transfer-batch-detail/transfer-batch-detail').then(
            (m) => m.TransferBatchDetailComponent,
          ),
      },
      {
        path: 'material-requests',
        loadComponent: () =>
          import('./features/inventory/material-requests/material-requests-list/material-requests-list').then(
            (m) => m.MaterialRequestsListComponent,
          ),
      },
      {
        path: 'material-requests/new',
        canActivate: [permissionGuard(Permission.MaterialRequestCreate, '/inventory/material-requests')],
        loadComponent: () =>
          import('./features/inventory/material-requests/material-request-create/material-request-create').then(
            (m) => m.MaterialRequestCreateComponent,
          ),
      },
      {
        path: 'material-requests/:id',
        loadComponent: () =>
          import('./features/inventory/material-requests/material-request-detail/material-request-detail').then(
            (m) => m.MaterialRequestDetailComponent,
          ),
      },
      {
        path: 'purchase-orders',
        loadComponent: () =>
          import('./features/inventory/purchase-orders/purchase-orders-list/purchase-orders-list').then(
            (m) => m.PurchaseOrdersListComponent,
          ),
      },
      {
        path: 'purchase-orders/new',
        canActivate: [permissionGuard(Permission.PurchaseOrderCreate, '/inventory/purchase-orders')],
        loadComponent: () =>
          import('./features/inventory/purchase-orders/purchase-order-create/purchase-order-create').then(
            (m) => m.PurchaseOrderCreateComponent,
          ),
      },
      {
        path: 'purchase-orders/:id',
        loadComponent: () =>
          import('./features/inventory/purchase-orders/purchase-order-detail/purchase-order-detail').then(
            (m) => m.PurchaseOrderDetailComponent,
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
    path: 'projects',
    children: [
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () =>
          import('./features/projects/projects-list/projects-list').then((m) => m.ProjectsListComponent),
      },
      {
        path: 'new',
        canActivate: [permissionGuard(Permission.ProjectCreate, '/projects')],
        loadComponent: () =>
          import('./features/projects/project-create/project-create').then((m) => m.ProjectCreateComponent),
      },
      {
        path: ':id',
        loadComponent: () =>
          import('./features/projects/project-detail/project-detail').then((m) => m.ProjectDetailComponent),
      },
    ],
  },

  {
    path: 'users',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./features/admin/admin-users/admin-users-list/admin-users-list').then(
        (m) => m.AdminUsersListComponent,
      ),
  },

  {
    path: '**',
    redirectTo: '',
  },
];