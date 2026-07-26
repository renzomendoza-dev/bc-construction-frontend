import { Routes } from '@angular/router';

export const routes: Routes = [
    {
    path: '',
    loadComponent: () =>
      import('./features/dashboard/dashboard').then((m) => m.Dashboard),
  },
 
  // Placeholder routes below — replace loadComponent target once each
  // feature module exists. Left commented so the app compiles cleanly
  // until you build them.
 
  // {
  //   path: 'inventory',
  //   loadChildren: () =>
  //     import('./features/inventory/inventory.routes').then((m) => m.INVENTORY_ROUTES),
  // },
  // {
  //   path: 'users',
  //   loadChildren: () =>
  //     import('./features/users/users.routes').then((m) => m.USERS_ROUTES),
  // },
 
  {
    path: '**',
    redirectTo: '',
  },
];
