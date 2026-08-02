import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { CurrentUserService } from '../services/current-user';
import { PermissionValue } from '../constants/permissions';

/** Gates a route behind a fine-grained permission, redirecting elsewhere (e.g. the list page) if missing. */
export function permissionGuard(permission: PermissionValue, redirectTo: string): CanActivateFn {
  return () => {
    const currentUser = inject(CurrentUserService);
    const router = inject(Router);

    if (currentUser.hasPermission(permission)) {
      return true;
    }

    return router.createUrlTree([redirectTo]);
  };
}
